/**
 * CMS "Medicare Physician & Other Practitioners - by Provider" - every
 * Medicare Part B provider (about 1.3 million a year), for every data year
 * CMS publishes (2013 onward), summarized at pull time into small tables
 * the agents can analyze. Added 2026-09-25 to replace the 5-state sample
 * in physicianOtherPractitioners.ts, which turned out to be the first
 * 1,000 rows per state in API order: 560 providers, all with NPIs between
 * 1003000639 and 1003432022, not a representative sample.
 *
 * Verified live 2026-09-25:
 *   GET https://data.cms.gov/data-api/v1/dataset/{id}/data?size=5000&offset=N&column=...
 * - `size` up to 5000 rows per request; `column=` returns only the named
 *   fields (a 5000-row page drops from 12MB to 1.7MB).
 * - Each data year is its own dataset id, listed in CMS's catalog
 *   (https://data.cms.gov/data.json) as a distribution with a `temporal`
 *   range. Field names are identical from 2013 through 2024.
 * No API key, no auth.
 *
 * Why summaries instead of raw rows: the raw file is too large to commit
 * (an earlier partial pull made a 112MB snapshot), and agents only ever
 * need totals and averages. Every provider is counted - nothing sampled.
 *
 * Storage: one file per data year under years/ (a past year never
 * changes, so it's pulled once), plus a small dated manifest under
 * snapshots/ recording each year file's content hash. The manifest is
 * what the reasoning change gate fingerprints, so a monthly pull that
 * finds nothing new costs nothing downstream.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SOURCE_ID = "cms:medicare-physician-by-provider";
export const DATASET_NAME = "medicare-physician-by-provider-summary";
const CATALOG_URL = "https://data.cms.gov/data.json";
const CATALOG_TITLE = "Medicare Physician & Other Practitioners - by Provider";
const API_BASE = "https://data.cms.gov/data-api/v1/dataset";
const PAGE_SIZE = 5000;
const CONCURRENCY = 3;
const TOP_N_PROVIDERS = 100;
const COLUMNS = [
  "Rndrng_NPI",
  "Rndrng_Prvdr_Last_Org_Name",
  "Rndrng_Prvdr_Ent_Cd",
  "Rndrng_Prvdr_Type",
  "Rndrng_Prvdr_State_Abrvtn",
  "Rndrng_Prvdr_RUCA",
  "Tot_Benes",
  "Tot_Srvcs",
  "Tot_Sbmtd_Chrg",
  "Tot_Mdcr_Alowd_Amt",
  "Tot_Mdcr_Pymt_Amt",
  "Tot_Mdcr_Stdzd_Amt",
  "Bene_Avg_Risk_Scre",
];

const DATA_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME);
const YEARS_DIR = path.join(DATA_DIR, "years");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");

/** Rural-Urban Commuting Area codes 1-3 / 4-6 / 7-10, CMS's own RUCA field on each provider. */
export type Rurality = "metropolitan" | "micropolitan" | "small-town-rural" | "unknown";

export interface Totals {
  providers: number;
  /** Sum of each provider's distinct beneficiaries - a patient seen by 2 providers counts twice, so this is not a count of unique people. */
  beneficiaryProviderPairs: number;
  services: number;
  submittedCharges: number;
  allowedAmount: number;
  medicarePayment: number;
  /** CMS's geographically standardized payment - the fair basis for comparing states. */
  standardizedPayment: number;
  /** Beneficiary-weighted average HCC risk score, null when no provider reported one. */
  avgRiskScore: number | null;
}

export interface StateTypeRow extends Totals {
  state: string;
  providerType: string;
}

export interface StateRuralityRow extends Totals {
  state: string;
  rurality: Rurality;
}

export interface TopProvider {
  npi: string;
  name: string;
  /** "I" individual, "O" organization. */
  entityCode: string;
  providerType: string;
  state: string;
  medicarePayment: number;
  services: number;
  beneficiaries: number;
}

export interface PhysicianYearSummary {
  dataset: string;
  dataYear: number;
  datasetId: string;
  pulledAt: string;
  providerCount: number;
  byStateType: StateTypeRow[];
  byStateRurality: StateRuralityRow[];
  topProviders: TopProvider[];
}

export interface PhysicianSummaryManifest {
  dataset: string;
  pulledAt: string;
  /** Data year -> sha256 of that year's summary file content. */
  years: Record<string, string>;
}

type RawRow = Record<string, string | undefined>;

interface Accumulator {
  providers: number;
  benes: number;
  services: number;
  charges: number;
  allowed: number;
  payment: number;
  standardized: number;
  riskWeighted: number;
  riskBenes: number;
}

function num(value: string | undefined): number {
  const n = Number(value);
  return value === undefined || value === "" || Number.isNaN(n) ? 0 : n;
}

export function ruralityOf(ruca: string | undefined): Rurality {
  const code = Math.floor(Number(ruca));
  if (!ruca || Number.isNaN(code)) return "unknown";
  if (code >= 1 && code <= 3) return "metropolitan";
  if (code >= 4 && code <= 6) return "micropolitan";
  if (code >= 7 && code <= 10) return "small-town-rural";
  return "unknown";
}

function emptyAccumulator(): Accumulator {
  return { providers: 0, benes: 0, services: 0, charges: 0, allowed: 0, payment: 0, standardized: 0, riskWeighted: 0, riskBenes: 0 };
}

function add(acc: Accumulator, row: RawRow): void {
  const benes = num(row.Tot_Benes);
  const risk = Number(row.Bene_Avg_Risk_Scre);
  acc.providers++;
  acc.benes += benes;
  acc.services += num(row.Tot_Srvcs);
  acc.charges += num(row.Tot_Sbmtd_Chrg);
  acc.allowed += num(row.Tot_Mdcr_Alowd_Amt);
  acc.payment += num(row.Tot_Mdcr_Pymt_Amt);
  acc.standardized += num(row.Tot_Mdcr_Stdzd_Amt);
  if (row.Bene_Avg_Risk_Scre && !Number.isNaN(risk) && benes > 0) {
    acc.riskWeighted += risk * benes;
    acc.riskBenes += benes;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function totals(acc: Accumulator): Totals {
  return {
    providers: acc.providers,
    beneficiaryProviderPairs: acc.benes,
    services: round2(acc.services),
    submittedCharges: round2(acc.charges),
    allowedAmount: round2(acc.allowed),
    medicarePayment: round2(acc.payment),
    standardizedPayment: round2(acc.standardized),
    avgRiskScore: acc.riskBenes > 0 ? Math.round((acc.riskWeighted / acc.riskBenes) * 10000) / 10000 : null,
  };
}

/** Folds provider rows, one at a time, into a year's summary tables - so 1.3M rows never sit in memory at once. */
export function createSummarizer(dataYear: number, datasetId: string) {
  const byStateType = new Map<string, Accumulator>();
  const byStateRurality = new Map<string, Accumulator>();
  const top: TopProvider[] = [];
  let providerCount = 0;

  function addRow(row: RawRow): void {
    const state = row.Rndrng_Prvdr_State_Abrvtn || "unknown";
    const type = row.Rndrng_Prvdr_Type || "unknown";
    providerCount++;

    const stKey = `${state}\u0000${type}`;
    if (!byStateType.has(stKey)) byStateType.set(stKey, emptyAccumulator());
    add(byStateType.get(stKey)!, row);

    const srKey = `${state}\u0000${ruralityOf(row.Rndrng_Prvdr_RUCA)}`;
    if (!byStateRurality.has(srKey)) byStateRurality.set(srKey, emptyAccumulator());
    add(byStateRurality.get(srKey)!, row);

    const payment = num(row.Tot_Mdcr_Pymt_Amt);
    if (top.length < TOP_N_PROVIDERS || payment > top[top.length - 1].medicarePayment) {
      top.push({
        npi: row.Rndrng_NPI ?? "",
        name: row.Rndrng_Prvdr_Last_Org_Name ?? "",
        entityCode: row.Rndrng_Prvdr_Ent_Cd ?? "",
        providerType: type,
        state,
        medicarePayment: payment,
        services: num(row.Tot_Srvcs),
        beneficiaries: num(row.Tot_Benes),
      });
      top.sort((a, b) => b.medicarePayment - a.medicarePayment);
      if (top.length > TOP_N_PROVIDERS) top.pop();
    }
  }

  const split = (key: string) => key.split("\u0000");
  const finish = (pulledAt: string): PhysicianYearSummary => ({
    dataset: DATASET_NAME,
    dataYear,
    datasetId,
    pulledAt,
    providerCount,
    byStateType: [...byStateType]
      .map(([key, acc]) => ({ state: split(key)[0], providerType: split(key)[1], ...totals(acc) }))
      .sort((a, b) => a.state.localeCompare(b.state) || a.providerType.localeCompare(b.providerType)),
    byStateRurality: [...byStateRurality]
      .map(([key, acc]) => ({ state: split(key)[0], rurality: split(key)[1] as Rurality, ...totals(acc) }))
      .sort((a, b) => a.state.localeCompare(b.state) || a.rurality.localeCompare(b.rurality)),
    topProviders: top,
  });
  return { addRow, finish };
}

/** Summarizes an in-memory set of rows. Exported for tests. */
export function summarizeRows(rows: Iterable<RawRow>, dataYear: number, datasetId: string, pulledAt: string): PhysicianYearSummary {
  const summarizer = createSummarizer(dataYear, datasetId);
  for (const row of rows) summarizer.addRow(row);
  return summarizer.finish(pulledAt);
}

/** Data year -> dataset id, from CMS's live catalog. */
export async function fetchYearDatasetIds(): Promise<Map<number, string>> {
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`CMS catalog fetch failed: ${res.status} ${res.statusText}`);
  const catalog = (await res.json()) as { dataset: { title: string; distribution?: { format?: string; accessURL?: string; temporal?: string }[] }[] };
  const entry = catalog.dataset.find((d) => d.title === CATALOG_TITLE);
  if (!entry) throw new Error(`"${CATALOG_TITLE}" not found in the CMS catalog`);

  const ids = new Map<number, string>();
  for (const dist of entry.distribution ?? []) {
    const match = dist.accessURL?.match(/data-api\/v1\/dataset\/([0-9a-f-]+)\/data/);
    const year = Number(dist.temporal?.slice(0, 4));
    // The catalog lists the latest year twice (API and a mirror); the first listed is the primary.
    if (match && year && !ids.has(year)) ids.set(year, match[1]);
  }
  return ids;
}

async function fetchPage(datasetId: string, offset: number, attempt = 1): Promise<RawRow[]> {
  const url = `${API_BASE}/${datasetId}/data?size=${PAGE_SIZE}&offset=${offset}&column=${COLUMNS.join(",")}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as RawRow[];
  } catch (err) {
    // "fetch failed" means the connection dropped with no HTTP response (seen live 2026-09-25 partway through a
    // year, then fine seconds later) - so back off for up to ~3 minutes in total, and keep the underlying cause.
    const cause = err instanceof Error && err.cause ? ` (cause: ${String(err.cause)})` : "";
    if (attempt >= 7) throw new Error(`CMS data-api page failed after ${attempt} attempts (${url}): ${err}${cause}`);
    await new Promise((r) => setTimeout(r, Math.min(5000 * 2 ** (attempt - 1), 60_000)));
    return fetchPage(datasetId, offset, attempt + 1);
  }
}

async function fetchRowCount(datasetId: string): Promise<number> {
  const res = await fetch(`${API_BASE}/${datasetId}/data/stats`);
  if (!res.ok) throw new Error(`CMS data-api stats failed for ${datasetId}: ${res.status}`);
  return ((await res.json()) as { total_rows: number }).total_rows;
}

/** Streams every row of one data year, CONCURRENCY pages at a time. */
async function* allRows(datasetId: string): AsyncGenerator<RawRow> {
  const total = await fetchRowCount(datasetId);
  for (let offset = 0; offset < total; offset += PAGE_SIZE * CONCURRENCY) {
    const offsets = Array.from({ length: CONCURRENCY }, (_, i) => offset + i * PAGE_SIZE).filter((o) => o < total);
    const pages = await Promise.all(offsets.map((o) => fetchPage(datasetId, o)));
    for (const page of pages) yield* page;
  }
}

function yearFile(year: number): string {
  return path.join(YEARS_DIR, `${year}.json`);
}

function hashFile(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/**
 * Pulls every data year not yet on disk (all of them, first time), and
 * re-pulls the latest year when `refreshLatest` is set. Writes a dated
 * manifest either way.
 */
export async function fetchAndSnapshot(options: { refreshLatest?: boolean; log?: (msg: string) => void } = {}): Promise<string> {
  const { refreshLatest = false, log = console.log } = options;
  const ids = await fetchYearDatasetIds();
  const years = [...ids.keys()].sort();
  const latest = years[years.length - 1];
  fs.mkdirSync(YEARS_DIR, { recursive: true });

  for (const year of years) {
    if (fs.existsSync(yearFile(year)) && !(refreshLatest && year === latest)) continue;
    const started = Date.now();
    const summarizer = createSummarizer(year, ids.get(year)!);
    for await (const row of allRows(ids.get(year)!)) summarizer.addRow(row);
    const summary = summarizer.finish(new Date().toISOString());
    // pulledAt is left out of the file so an unchanged re-pull hashes identically.
    const { pulledAt: _pulledAt, ...content } = summary;
    void _pulledAt;
    fs.writeFileSync(yearFile(year), JSON.stringify(content));
    log(`[physician-summary] ${year}: ${summary.providerCount} providers, ${summary.byStateType.length} state x type rows (${Math.round((Date.now() - started) / 1000)}s)`);
  }

  const manifest: PhysicianSummaryManifest = {
    dataset: DATASET_NAME,
    pulledAt: new Date().toISOString(),
    years: Object.fromEntries(years.filter((y) => fs.existsSync(yearFile(y))).map((y) => [String(y), hashFile(yearFile(y))])),
  };
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const file = path.join(SNAPSHOTS_DIR, `${manifest.pulledAt.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return file;
}

export type PhysicianYearData = Omit<PhysicianYearSummary, "pulledAt">;

/** Every summarized data year on disk, oldest first. */
export function loadAllYears(dir: string = YEARS_DIR): PhysicianYearData[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as PhysicianYearData);
}
