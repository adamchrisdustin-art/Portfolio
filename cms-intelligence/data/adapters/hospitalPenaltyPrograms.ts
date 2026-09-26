/**
 * CMS's three hospital pay-for-performance programs, per hospital (CCN):
 * - Hospital Readmissions Reduction Program (HRRP): excess readmission
 *   ratio by condition, and the payment adjustment factor (a cut of up to
 *   3%).
 * - Hospital-Acquired Condition (HAC) Reduction Program: Total HAC Score
 *   and whether the hospital takes the 1% cut (worst-performing quartile).
 * - Hospital Value-Based Purchasing (HVBP): Total Performance Score and the
 *   adjustment factor (a bonus or a cut, funded by a 2% withhold).
 * Added 2026-09-25 so the reimbursement agent can say which facilities
 * face payment cuts and where.
 *
 * Verified live 2026-09-25:
 * - Provider Data Catalog datastore (no key): HRRP 9n3s-kdb3 (18,330
 *   hospital x measure rows), HAC yq43-i98g (3,055 hospitals,
 *   payment_reduction Yes/No), HVBP Total Performance Score ypbt-wvdk
 *   (2,455 hospitals, with each domain's score). All FY2026, modified
 *   2026-01-26. The four HVBP domain datasets (pudb-wetr, su9h-3pvj,
 *   avtz-f2ge, dgmq-aat3) were checked too; they hold measure-level points
 *   behind the domain scores the TPS file already carries, so they aren't
 *   stored.
 * - The HRRP and HVBP adjustment factors themselves are not in the
 *   datastore; they are Table 15 and Table 16B of the IPPS final rule,
 *   zips linked from the fiscal year's final-rule page (tab-separated text
 *   inside, "CCN<TAB>factor" rows with title and footnote lines around
 *   them; 641 hospitals with no HRRP cut are written as a bare "1").
 *   FY2026: 2,945 HRRP factors, 2,448 HVBP factors. The FY2027 page
 *   says Table 15 is withheld until hospitals review it and Table 16B
 *   comes "in the Fall of 2026", so this adapter reads the fiscal year the
 *   datastore reports and picks up the next one when CMS moves to it.
 *
 * Storage: one file per fiscal year under fiscal-years/, overwritten each
 * pull, plus a dated manifest of its hash under snapshots/ for the
 * reasoning change gate.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";

export const SOURCE_ID = "cms:hospital-penalty-programs";
export const DATASET_NAME = "hospital-penalty-programs";
const DATASTORE = "https://data.cms.gov/provider-data/api/1/datastore/query";
const METASTORE = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items";
export const DATASET_IDS = { hrrp: "9n3s-kdb3", hac: "yq43-i98g", hvbp: "ypbt-wvdk" } as const;
const PAGE_SIZE = 500;
const CMS_ORIGIN = "https://www.cms.gov";
export const ippsFinalRulePage = (fy: number) => `${CMS_ORIGIN}/medicare/payment/prospective-payment-systems/acute-inpatient-pps/fy-${fy}-ipps-final-rule-home-page`;

const DATA_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME);
const YEARS_DIR = path.join(DATA_DIR, "fiscal-years");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");

export interface HospitalPenaltyRow {
  ccn: string;
  state: string;
  /** Condition -> excess readmission ratio (above 1 = more readmissions than expected). Only measures CMS scored. */
  readmissionRatios: Record<string, number>;
  hacScore: number | null;
  /** True = the 1% HAC cut applies. Null when CMS didn't score the hospital. */
  hacPenalty: boolean | null;
  hvbpTotalPerformanceScore: number | null;
  /** IPPS Table 15; below 1 is a cut. Null when the hospital isn't in the program. */
  hrrpFactor: number | null;
  /** IPPS Table 16B; below 1 is a net cut, above 1 a net bonus. */
  hvbpFactor: number | null;
}

export interface HospitalPenaltyYear {
  dataset: string;
  fiscalYear: number;
  /** Each datastore dataset's CMS "modified" date. */
  datasetModified: Record<keyof typeof DATASET_IDS, string>;
  table15Url: string | null;
  table16bUrl: string | null;
  hospitals: HospitalPenaltyRow[];
}

type RawRow = Record<string, string | undefined>;

const num = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** "CCN<TAB>factor" rows from an IPPS Table 15 or 16B text file; titles and footnotes are skipped. Exported for tests. */
export function parseFactorTable(text: string): Map<string, number> {
  const factors = new Map<string, number>();
  for (const line of text.split(/\r\n|\r|\n/)) {
    // A hospital with no cut is written as a bare "1".
    const m = line.match(/^([0-9A-Z]{6})\t\s*([0-9]+(?:\.[0-9]+)?)\s*(?:\t|$)/);
    if (m) factors.set(m[1], Number(m[2]));
  }
  return factors;
}

/** Joins the three programs and the two factor tables by CCN. Exported for tests. */
export function combinePrograms(input: {
  hrrp: RawRow[];
  hac: RawRow[];
  hvbp: RawRow[];
  hrrpFactors: Map<string, number>;
  hvbpFactors: Map<string, number>;
}): HospitalPenaltyRow[] {
  const byCcn = new Map<string, HospitalPenaltyRow>();
  const get = (ccn: string, state: string | undefined) => {
    let row = byCcn.get(ccn);
    if (!row) {
      row = { ccn, state: state ?? "", readmissionRatios: {}, hacScore: null, hacPenalty: null, hvbpTotalPerformanceScore: null, hrrpFactor: null, hvbpFactor: null };
      byCcn.set(ccn, row);
    }
    if (!row.state && state) row.state = state;
    return row;
  };
  for (const r of input.hrrp) {
    if (!r.facility_id) continue;
    const row = get(r.facility_id, r.state);
    const ratio = num(r.excess_readmission_ratio);
    const measure = (r.measure_name ?? "").replace(/^READM-30-/, "").replace(/-HRRP$/, "");
    if (ratio !== null && measure) row.readmissionRatios[measure] = ratio;
  }
  for (const r of input.hac) {
    if (!r.facility_id) continue;
    const row = get(r.facility_id, r.state);
    row.hacScore = num(r.total_hac_score);
    row.hacPenalty = r.payment_reduction === "Yes" ? true : r.payment_reduction === "No" ? false : null;
  }
  for (const r of input.hvbp) {
    if (!r.facility_id) continue;
    get(r.facility_id, r.state).hvbpTotalPerformanceScore = num(r.total_performance_score);
  }
  for (const [ccn, f] of input.hrrpFactors) get(ccn, undefined).hrrpFactor = f;
  for (const [ccn, f] of input.hvbpFactors) get(ccn, undefined).hvbpFactor = f;
  return [...byCcn.values()].sort((a, b) => a.ccn.localeCompare(b.ccn));
}

async function fetchWithRetry(url: string, attempt = 1): Promise<Response> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res;
  } catch (err) {
    if (attempt >= 5) throw new Error(`CMS request failed after ${attempt} attempts (${url}): ${err}`, { cause: err });
    await new Promise((r) => setTimeout(r, 5000 * 2 ** (attempt - 1)));
    return fetchWithRetry(url, attempt + 1);
  }
}

async function fetchDatastore(id: string): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = (await (await fetchWithRetry(`${DATASTORE}/${id}/0?limit=${PAGE_SIZE}&offset=${offset}`)).json()) as { results: RawRow[] };
    rows.push(...page.results);
    if (page.results.length < PAGE_SIZE) return rows;
  }
}

/** A factor table zip from the fiscal year's final-rule page, or null while CMS hasn't posted it. */
async function fetchFactorTable(fy: number, pattern: RegExp, log: (msg: string) => void): Promise<{ url: string; factors: Map<string, number> } | null> {
  const page = ippsFinalRulePage(fy);
  const html = await (await fetchWithRetry(page)).text();
  const href = [...html.matchAll(/href="([^"]+\.zip)"/gi)].map((m) => m[1]).find((h) => pattern.test(h));
  if (!href) {
    log(`[hospital-penalties] FY${fy}: no ${pattern} zip on ${page} yet`);
    return null;
  }
  const url = href.startsWith("http") ? href : `${CMS_ORIGIN}${href}`;
  const files = unzipSync(new Uint8Array(await (await fetchWithRetry(url)).arrayBuffer()));
  const txt = Object.keys(files).find((n) => n.toLowerCase().endsWith(".txt"));
  if (!txt) throw new Error(`No .txt table in ${url}`);
  const factors = parseFactorTable(new TextDecoder("latin1").decode(files[txt]));
  if (factors.size === 0) throw new Error(`No CCN rows parsed from ${url} (${txt})`);
  return { url, factors };
}

function hashFile(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

export async function fetchAndSnapshot(log: (msg: string) => void = console.log): Promise<string> {
  const [hrrp, hac, hvbp] = await Promise.all([fetchDatastore(DATASET_IDS.hrrp), fetchDatastore(DATASET_IDS.hac), fetchDatastore(DATASET_IDS.hvbp)]);
  const fiscalYear = Number(hac.find((r) => r.fiscal_year)?.fiscal_year);
  if (!Number.isInteger(fiscalYear)) throw new Error("HAC dataset has no fiscal_year - schema may have changed");
  const modified = async (id: string) => ((await (await fetchWithRetry(`${METASTORE}/${id}`)).json()) as { modified: string }).modified;
  const datasetModified = { hrrp: await modified(DATASET_IDS.hrrp), hac: await modified(DATASET_IDS.hac), hvbp: await modified(DATASET_IDS.hvbp) };
  const table15 = await fetchFactorTable(fiscalYear, /readmissions-reduction-program-payment-adjustment-factors/i, log);
  const table16b = await fetchFactorTable(fiscalYear, /table-16b/i, log);

  const year: HospitalPenaltyYear = {
    dataset: DATASET_NAME,
    fiscalYear,
    datasetModified,
    table15Url: table15?.url ?? null,
    table16bUrl: table16b?.url ?? null,
    hospitals: combinePrograms({ hrrp, hac, hvbp, hrrpFactors: table15?.factors ?? new Map(), hvbpFactors: table16b?.factors ?? new Map() }),
  };
  fs.mkdirSync(YEARS_DIR, { recursive: true });
  const yearFile = path.join(YEARS_DIR, `${fiscalYear}.json`);
  fs.writeFileSync(yearFile, JSON.stringify(year));
  log(
    `[hospital-penalties] FY${fiscalYear}: ${year.hospitals.length} hospitals; HRRP rows ${hrrp.length}, HAC ${hac.length}, HVBP ${hvbp.length}; Table 15 ${table15?.factors.size ?? 0}, Table 16B ${table16b?.factors.size ?? 0}`
  );

  const manifest = { dataset: DATASET_NAME, pulledAt: new Date().toISOString(), fiscalYears: { [String(fiscalYear)]: hashFile(yearFile) } };
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const file = path.join(SNAPSHOTS_DIR, `${manifest.pulledAt.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return file;
}

/** The newest fiscal year on disk, or null before the first pull. */
export function loadLatestPenaltyYear(dir: string = YEARS_DIR): HospitalPenaltyYear | null {
  if (!fs.existsSync(dir)) return null;
  const latest = fs.readdirSync(dir).filter((f) => /^\d{4}\.json$/.test(f)).sort().at(-1);
  return latest ? (JSON.parse(fs.readFileSync(path.join(dir, latest), "utf-8")) as HospitalPenaltyYear) : null;
}
