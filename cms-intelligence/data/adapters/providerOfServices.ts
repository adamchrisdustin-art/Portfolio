/**
 * CMS Provider of Services (POS) files - every Medicare/Medicaid-certified
 * facility, one row per CMS Certification Number (CCN), with its category,
 * state, certified bed count, original participation date and termination
 * status. Added 2026-09-25 to replace the Market Growth agent's capacity
 * proxy (a hospital count from one Hospital General Information snapshot)
 * with real certified beds and a history.
 *
 * Two catalog entries, verified live 2026-09-25 (data.cms.gov/data.json):
 * - "Provider of Services File - Quality Improvement and Evaluation System"
 *   (QIES): Q4 of each year 2011-2017, then every quarter from 2018-Q4
 *   through 2026-Q2, each quarter its own dataset id. 473 columns,
 *   upper-case names (PRVDR_CTGRY_CD, CRTFD_BED_CNT, PGM_TRMNTN_CD...).
 * - "Provider of Services File - Internet Quality Improvement and
 *   Evaluation System" (iQIES): every quarter from 2023-Q4. Lower-case
 *   column names, a numeric prvdr_type_id instead of the category code,
 *   and "Not Available"/"Not Applicable" in empty cells.
 *
 * Provider types moved from QIES to iQIES in waves, so a type is in one
 * file or the other in any quarter, never both (checked live 2026-09-25):
 * home health, ambulatory surgery and hospice from 2023-Q4, nursing homes
 * from 2025-Q3 (QIES 2025-Q2: 14,866 active in categories 02/03/04/10;
 * iQIES 2025-Q3: 14,731 active type 20), ESRD, ICF/IID, therapy and
 * rehabilitation clinics later. Hospitals, rural health clinics and FQHCs
 * are still QIES-only. Each quarter's facility-type total comes from
 * whichever file has that type (combineQuarter below), so nothing is
 * double counted, and each quarter records which file it used.
 *
 * Both files keep terminated providers with their termination date and
 * reason, so the latest file alone gives a dated history of openings
 * (original participation date) and closures (termination date).
 *
 * Summarized at pull time like the physician summaries: one small file per
 * file-quarter under quarters/ (a past quarter never changes, so it's
 * pulled once), plus a dated manifest under snapshots/ with each file's
 * content hash for the reasoning change gate. No API key, no auth.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SOURCE_ID = "cms:provider-of-services";
export const DATASET_NAME = "provider-of-services-summary";
const CATALOG_URL = "https://data.cms.gov/data.json";
export const QIES_TITLE = "Provider of Services File - Quality Improvement and Evaluation System";
export const IQIES_TITLE = "Provider of Services File - Internet Quality Improvement and Evaluation System";
const API_BASE = "https://data.cms.gov/data-api/v1/dataset";
const PAGE_SIZE = 5000;
const CONCURRENCY = 3;
/** National openings/closures are kept for every year from this one. */
const EVENTS_FROM_YEAR = 2011;

const QIES_COLUMNS = ["PRVDR_NUM", "PRVDR_CTGRY_CD", "PRVDR_CTGRY_SBTYP_CD", "STATE_CD", "PGM_TRMNTN_CD", "TRMNTN_EXPRTN_DT", "ORGNL_PRTCPTN_DT", "CRTFD_BED_CNT"];
const IQIES_COLUMNS = ["prvdr_num", "prvdr_type_id", "state_cd", "pgm_trmntn_cd", "trmntn_exprtn_dt", "orgnl_prtcptn_dt", "crtfd_bed_cnt"];

const DATA_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME);
const QUARTERS_DIR = path.join(DATA_DIR, "quarters");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");

export type PosSystem = "qies" | "iqies";

/** Facility types tracked. Types with no stable home across both files (portable x-ray, CMHCs, OPOs...) are left out rather than showing a jump when they move. */
export const FACILITY_TYPES = [
  "short-term-acute-hospital",
  "critical-access-hospital",
  "other-hospital",
  "nursing-home",
  "home-health-agency",
  "hospice",
  "ambulatory-surgical-center",
  "esrd-facility",
  "icf-iid",
  "rural-health-clinic",
  "fqhc",
] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  "short-term-acute-hospital": "Short-term acute care hospitals",
  "critical-access-hospital": "Critical access hospitals",
  "other-hospital": "Other hospitals (psychiatric, rehabilitation, long-term care, children's)",
  "nursing-home": "Nursing homes (SNF/NF)",
  "home-health-agency": "Home health agencies",
  hospice: "Hospices",
  "ambulatory-surgical-center": "Ambulatory surgical centers",
  "esrd-facility": "Dialysis (ESRD) facilities",
  "icf-iid": "Intermediate care facilities for individuals with intellectual disabilities",
  "rural-health-clinic": "Rural health clinics",
  fqhc: "Federally qualified health centers",
};

/** QIES PRVDR_CTGRY_CD (and hospital subtype) -> facility type. Codes from CMS's QIES POS record layout. */
export function qiesFacilityType(category: string | undefined, subtype: string | undefined): FacilityType | null {
  switch ((category ?? "").trim()) {
    case "01":
      if (subtype === "01") return "short-term-acute-hospital";
      if (subtype === "11") return "critical-access-hospital";
      return "other-hospital";
    case "02":
    case "03":
    case "04":
    case "10":
      return "nursing-home";
    case "05":
      return "home-health-agency";
    case "09":
      return "esrd-facility";
    case "11":
      return "icf-iid";
    case "12":
      return "rural-health-clinic";
    case "15":
      return "ambulatory-surgical-center";
    case "16":
      return "hospice";
    case "21":
      return "fqhc";
    default:
      return null;
  }
}

/** iQIES prvdr_type_id -> facility type (lookup sheet M1 of CMS's iQIES POS data dictionary, July 2026). */
export function iqiesFacilityType(typeId: string | undefined): FacilityType | null {
  switch ((typeId ?? "").trim()) {
    case "3":
      return "home-health-agency";
    case "7":
      return "esrd-facility";
    case "8":
      return "icf-iid";
    case "11":
      return "ambulatory-surgical-center";
    case "12":
      return "hospice";
    case "20":
      return "nursing-home";
    default:
      return null;
  }
}

/** Termination codes (identical in both files): 00 active, 01 voluntary merger/closure, 02 dissatisfied with reimbursement, 03 risk of involuntary termination, 04 other voluntary, 05 failed health/safety, 06 failed agreement, 07 provider status change. */
export const TERMINATION_REASONS: Record<string, string> = {
  "01": "Voluntary merger or closure",
  "02": "Voluntary, dissatisfied with reimbursement",
  "03": "Voluntary, risk of involuntary termination",
  "04": "Voluntary, other reason",
  "05": "Involuntary, failed health/safety requirements",
  "06": "Involuntary, failed agreement terms",
  "07": "Provider status change",
};

type RawRow = Record<string, string | undefined>;

export interface NormalizedPosRow {
  ccn: string;
  type: FacilityType;
  state: string;
  active: boolean;
  /** Certified beds, null when the file has none for this provider. */
  beds: number | null;
  openedYear: number | null;
  closedYear: number | null;
  /** Two-digit termination code for a terminated provider, "" for an active one. */
  terminationCode: string;
}

const MISSING = new Set(["", "Not Available", "Not Applicable"]);
const clean = (v: string | undefined) => (v === undefined || MISSING.has(v.trim()) ? "" : v.trim());

function yearOf(date: string): number | null {
  const y = Number(date.slice(0, 4));
  return date.length >= 8 && y > 1900 ? y : null;
}

/**
 * Reads one row from either file into the same shape. Active means
 * termination code 00; the first iQIES quarter (2023-Q4) left the code
 * blank for active providers, so a blank code with no termination date also
 * counts as active.
 */
export function normalizePosRow(raw: RawRow, system: PosSystem): NormalizedPosRow | null {
  const get = (upper: string) => clean(system === "qies" ? raw[upper] : raw[upper.toLowerCase()]);
  const type = system === "qies" ? qiesFacilityType(get("PRVDR_CTGRY_CD"), get("PRVDR_CTGRY_SBTYP_CD")) : iqiesFacilityType(get("PRVDR_TYPE_ID"));
  const state = get("STATE_CD");
  if (!type || !/^[A-Z]{2}$/.test(state)) return null;
  const code = get("PGM_TRMNTN_CD");
  const terminationDate = get("TRMNTN_EXPRTN_DT");
  const active = code === "00" || (code === "" && terminationDate === "");
  const beds = Number(get("CRTFD_BED_CNT"));
  return {
    ccn: get("PRVDR_NUM"),
    type,
    state,
    active,
    beds: get("CRTFD_BED_CNT") === "" || Number.isNaN(beds) ? null : beds,
    openedYear: yearOf(get("ORGNL_PRTCPTN_DT")),
    closedYear: active ? null : yearOf(terminationDate),
    terminationCode: active ? "" : code,
  };
}

/** [state, type, all rows, active providers, active certified beds] */
export type StateTypeRow = [string, FacilityType, number, number, number];

export interface NationalEventRow {
  type: FacilityType;
  year: number;
  openings: number;
  closures: number;
  /** Closures by termination code (see TERMINATION_REASONS). */
  closuresByReason: Record<string, number>;
}

export interface PosQuarterSummary {
  dataset: string;
  system: PosSystem;
  /** e.g. "2026-Q2" */
  quarter: string;
  periodStart: string;
  periodEnd: string;
  datasetId: string;
  rowCount: number;
  byStateType: StateTypeRow[];
  eventsNational: NationalEventRow[];
}

export interface PosManifest {
  dataset: string;
  pulledAt: string;
  /** File name -> sha256 of its content. */
  files: Record<string, string>;
}

export function quarterOf(periodStart: string): string {
  return `${periodStart.slice(0, 4)}-Q${Math.floor((Number(periodStart.slice(5, 7)) - 1) / 3) + 1}`;
}

/** Folds rows one at a time into a file-quarter summary. */
export function createPosSummarizer(meta: { system: PosSystem; periodStart: string; periodEnd: string; datasetId: string }) {
  const byStateType = new Map<string, [number, number, number]>();
  const national = new Map<string, NationalEventRow>();
  const fileYear = Number(meta.periodEnd.slice(0, 4));
  let rowCount = 0;

  function addRow(raw: RawRow): void {
    rowCount++;
    const row = normalizePosRow(raw, meta.system);
    if (!row) return;
    const key = `${row.state}|${row.type}`;
    const cell = byStateType.get(key) ?? [0, 0, 0];
    cell[0]++;
    if (row.active) {
      cell[1]++;
      cell[2] += row.beds ?? 0;
    }
    byStateType.set(key, cell);

    const event = (year: number | null, kind: "open" | "close") => {
      if (year === null || year < EVENTS_FROM_YEAR || year > fileYear) return;
      const nKey = `${row.type}|${year}`;
      const n = national.get(nKey) ?? { type: row.type, year, openings: 0, closures: 0, closuresByReason: {} };
      if (kind === "open") n.openings++;
      else {
        n.closures++;
        const reason = row.terminationCode || "unknown";
        n.closuresByReason[reason] = (n.closuresByReason[reason] ?? 0) + 1;
      }
      national.set(nKey, n);
    };
    event(row.openedYear, "open");
    event(row.closedYear, "close");
  }

  function finish(): PosQuarterSummary {
    return {
      dataset: DATASET_NAME,
      system: meta.system,
      quarter: quarterOf(meta.periodStart),
      periodStart: meta.periodStart,
      periodEnd: meta.periodEnd,
      datasetId: meta.datasetId,
      rowCount,
      byStateType: [...byStateType]
        .map(([key, [rows, active, beds]]) => {
          const [state, type] = key.split("|");
          return [state, type as FacilityType, rows, active, beds] as StateTypeRow;
        })
        .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])),
      eventsNational: [...national.values()].sort((a, b) => a.type.localeCompare(b.type) || a.year - b.year),
    };
  }
  return { addRow, finish };
}

export function summarizePosRows(rows: Iterable<RawRow>, meta: { system: PosSystem; periodStart: string; periodEnd: string; datasetId: string }): PosQuarterSummary {
  const s = createPosSummarizer(meta);
  for (const row of rows) s.addRow(row);
  return s.finish();
}

// ---------------------------------------------------------------------------
// Combining the two files into one comparable quarterly history
// ---------------------------------------------------------------------------

export interface TypeQuarter {
  providers: number;
  beds: number;
  byState: Map<string, { providers: number; beds: number }>;
  system: PosSystem;
  /** Dated openings/closures by year as this quarter's file records them. */
  events: NationalEventRow[];
}

export interface CombinedQuarter {
  quarter: string;
  periodEnd: string;
  types: Map<FacilityType, TypeQuarter>;
}

function typeTotals(summary: PosQuarterSummary, type: FacilityType): TypeQuarter {
  const byState = new Map<string, { providers: number; beds: number }>();
  let providers = 0;
  let beds = 0;
  for (const [state, t, , active, activeBeds] of summary.byStateType) {
    if (t !== type) continue;
    byState.set(state, { providers: active, beds: activeBeds });
    providers += active;
    beds += activeBeds;
  }
  return { providers, beds, byState, system: summary.system, events: summary.eventsNational.filter((e) => e.type === type) };
}

/**
 * One quarter's totals per facility type, each type taken from the file
 * that carries it. If both files ever carried the same type in one quarter
 * the one with more active providers is used, so a type is never summed
 * across files.
 */
export function combineQuarter(qies: PosQuarterSummary | undefined, iqies: PosQuarterSummary | undefined): CombinedQuarter | null {
  const base = qies ?? iqies;
  if (!base) return null;
  const types = new Map<FacilityType, TypeQuarter>();
  for (const type of FACILITY_TYPES) {
    const a = qies ? typeTotals(qies, type) : null;
    const b = iqies ? typeTotals(iqies, type) : null;
    const pick = !a || a.providers === 0 ? b : !b || b.providers === 0 ? a : a.providers >= b.providers ? a : b;
    if (pick && pick.providers > 0) types.set(type, pick);
  }
  return { quarter: base.quarter, periodEnd: base.periodEnd, types };
}

/** Every quarter on disk combined, oldest first. */
export function combinedHistory(summaries: PosQuarterSummary[]): CombinedQuarter[] {
  const byQuarter = new Map<string, { qies?: PosQuarterSummary; iqies?: PosQuarterSummary }>();
  for (const s of summaries) {
    const entry = byQuarter.get(s.quarter) ?? {};
    entry[s.system] = s;
    byQuarter.set(s.quarter, entry);
  }
  return [...byQuarter.keys()]
    .sort()
    .map((q) => combineQuarter(byQuarter.get(q)!.qies, byQuarter.get(q)!.iqies))
    .filter((q): q is CombinedQuarter => q !== null);
}

/** A quarter-to-quarter move this large that reverses the next quarter is a defective file, not a real change. */
const DEFECT_SWING = 0.04;

/**
 * Quarters whose count for a type can't be compared, found live 2026-09-25:
 * - Frozen: the same active count and beds as the quarter before. QIES
 *   stopped updating home health (11,506 from 2021-Q4) and ambulatory
 *   surgery (6,088 from 2022-Q2) until iQIES took them over in 2023-Q4.
 * - Defective: a swing of 4%+ that reverses the next quarter. The 2020-Q1
 *   QIES file dropped about 6% of nursing homes and 16% of home health
 *   agencies, and 2020-Q2 lost the short-term hospital subtype code.
 */
export function unusableQuarters(history: CombinedQuarter[], type: FacilityType): Set<string> {
  const out = new Set<string>();
  const points = history.map((q) => ({ quarter: q.quarter, t: q.types.get(type) }));
  for (let i = 0; i < points.length; i++) {
    const { quarter, t } = points[i];
    if (!t) {
      out.add(quarter);
      continue;
    }
    const prev = points[i - 1]?.t;
    const next = points[i + 1]?.t;
    if (prev && prev.providers === t.providers && prev.beds === t.beds && prev.system === t.system) out.add(quarter);
    if (prev && next) {
      const up = t.providers / prev.providers - 1;
      const back = next.providers / t.providers - 1;
      if (Math.abs(up) >= DEFECT_SWING && Math.abs(back) >= DEFECT_SWING && Math.sign(up) !== Math.sign(back)) out.add(quarter);
    }
  }
  return out;
}

export interface AnnualPoint {
  year: number;
  quarter: string;
  periodEnd: string;
  providers: number;
  beds: number;
  byState: Map<string, { providers: number; beds: number }>;
  system: PosSystem;
}

/** The fourth-quarter file of each year (the only quarter CMS published before 2018), skipping unusable quarters. */
export function annualSeries(history: CombinedQuarter[], type: FacilityType): AnnualPoint[] {
  const bad = unusableQuarters(history, type);
  return history
    .filter((q) => q.quarter.endsWith("-Q4") && !bad.has(q.quarter) && q.types.has(type))
    .map((q) => {
      const t = q.types.get(type)!;
      return { year: Number(q.quarter.slice(0, 4)), quarter: q.quarter, periodEnd: q.periodEnd, providers: t.providers, beds: t.beds, byState: t.byState, system: t.system };
    });
}

/**
 * Openings and closures in a year, as recorded by the file for `asOf`.
 * Terminations keep being recorded for a while after they happen, so a
 * year is only compared with another year recorded at the same lag.
 */
export function eventsFor(history: CombinedQuarter[], type: FacilityType, year: number, asOf: string): NationalEventRow | null {
  const t = history.find((q) => q.quarter === asOf)?.types.get(type);
  return t?.events.find((e) => e.year === year) ?? null;
}

// ---------------------------------------------------------------------------
// Live pull
// ---------------------------------------------------------------------------

export interface PosFileRef {
  system: PosSystem;
  quarter: string;
  periodStart: string;
  periodEnd: string;
  datasetId: string;
}

/** Every quarterly version of both POS files, from CMS's live catalog. */
export async function fetchPosFileRefs(): Promise<PosFileRef[]> {
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`CMS catalog fetch failed: ${res.status} ${res.statusText}`);
  const catalog = (await res.json()) as { dataset: { title: string; distribution?: { accessURL?: string; temporal?: string }[] }[] };
  const refs: PosFileRef[] = [];
  for (const [system, title] of [
    ["qies", QIES_TITLE],
    ["iqies", IQIES_TITLE],
  ] as const) {
    const entry = catalog.dataset.find((d) => d.title === title);
    if (!entry) throw new Error(`"${title}" not found in the CMS catalog`);
    const seen = new Set<string>();
    for (const dist of entry.distribution ?? []) {
      const match = dist.accessURL?.match(/data-api\/v1\/dataset\/([0-9a-f-]+)\/data/);
      const [start, end] = (dist.temporal ?? "").split("/");
      // Each version is listed twice (API and a mirror); the first listed is the primary.
      if (!match || !start || !end || seen.has(start)) continue;
      seen.add(start);
      refs.push({ system, quarter: quarterOf(start), periodStart: start, periodEnd: end, datasetId: match[1] });
    }
  }
  return refs.sort((a, b) => a.quarter.localeCompare(b.quarter) || a.system.localeCompare(b.system));
}

async function fetchPage(url: string, attempt = 1): Promise<RawRow[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as RawRow[];
  } catch (err) {
    const cause = err instanceof Error && err.cause ? ` (cause: ${String(err.cause)})` : "";
    if (attempt >= 7) throw new Error(`CMS data-api page failed after ${attempt} attempts (${url}): ${err}${cause}`);
    await new Promise((r) => setTimeout(r, Math.min(5000 * 2 ** (attempt - 1), 60_000)));
    return fetchPage(url, attempt + 1);
  }
}

async function* allRows(ref: PosFileRef): AsyncGenerator<RawRow> {
  const stats = await fetch(`${API_BASE}/${ref.datasetId}/data/stats`);
  if (!stats.ok) throw new Error(`CMS data-api stats failed for ${ref.datasetId}: ${stats.status}`);
  const total = ((await stats.json()) as { total_rows: number }).total_rows;
  const columns = (ref.system === "qies" ? QIES_COLUMNS : IQIES_COLUMNS).join(",");
  for (let offset = 0; offset < total; offset += PAGE_SIZE * CONCURRENCY) {
    const offsets = Array.from({ length: CONCURRENCY }, (_, i) => offset + i * PAGE_SIZE).filter((o) => o < total);
    const pages = await Promise.all(offsets.map((o) => fetchPage(`${API_BASE}/${ref.datasetId}/data?size=${PAGE_SIZE}&offset=${o}&column=${columns}`)));
    for (const page of pages) yield* page;
  }
}

const quarterFile = (ref: { system: PosSystem; quarter: string }) => path.join(QUARTERS_DIR, `${ref.system}-${ref.quarter}.json`);
const hashFile = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/** Pulls every file-quarter not yet on disk, re-pulling the newest quarter when `refreshLatest` is set, and writes a dated manifest. */
export async function fetchAndSnapshot(options: { refreshLatest?: boolean; log?: (msg: string) => void } = {}): Promise<string> {
  const { refreshLatest = false, log = console.log } = options;
  const refs = await fetchPosFileRefs();
  const latestQuarter = refs.map((r) => r.quarter).sort().at(-1);
  fs.mkdirSync(QUARTERS_DIR, { recursive: true });

  for (const ref of refs) {
    if (fs.existsSync(quarterFile(ref)) && !(refreshLatest && ref.quarter === latestQuarter)) continue;
    const started = Date.now();
    const summarizer = createPosSummarizer(ref);
    for await (const row of allRows(ref)) summarizer.addRow(row);
    const summary = summarizer.finish();
    fs.writeFileSync(quarterFile(ref), JSON.stringify(summary));
    log(`[pos-summary] ${ref.system} ${ref.quarter}: ${summary.rowCount} rows (${Math.round((Date.now() - started) / 1000)}s)`);
  }

  const files = fs.readdirSync(QUARTERS_DIR).filter((f) => f.endsWith(".json")).sort();
  const manifest: PosManifest = {
    dataset: DATASET_NAME,
    pulledAt: new Date().toISOString(),
    files: Object.fromEntries(files.map((f) => [f, hashFile(path.join(QUARTERS_DIR, f))])),
  };
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const file = path.join(SNAPSHOTS_DIR, `${manifest.pulledAt.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return file;
}

/** Every file-quarter summary on disk. */
export function loadAllQuarters(dir: string = QUARTERS_DIR): PosQuarterSummary[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^(qies|iqies)-\d{4}-Q\d\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as PosQuarterSummary);
}
