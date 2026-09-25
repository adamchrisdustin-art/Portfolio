/**
 * CMS "Medicare Physician & Other Practitioners - by Geography and
 * Service" - national Medicare Part B totals for every procedure code
 * (HCPCS), for every data year CMS publishes (2013 onward). Added
 * 2026-09-25 so the claims agent can answer "which services are growing
 * fastest" (Q011) by service, not only by provider specialty.
 *
 * Verified live 2026-09-25:
 * - Each data year is its own dataset id in CMS's catalog (same catalog
 *   lookup as physicianByProviderSummary.ts). About 268,000 rows a year,
 *   of which 13,463 (2024) are national - `filter[Rndrng_Prvdr_Geo_Lvl]=
 *   National` returns just those, so a year is 3 requests.
 * - Each national row is one code x place of service (F facility, O
 *   office) with per-service averages; this adapter multiplies averages by
 *   service counts to get totals and combines the two places of service.
 * - Categories come from CMS's Restructured BETOS Classification System
 *   (RBCS, catalog title "Restructured BETOS Classification System"),
 *   20,081 rows mapping each code to a category and subcategory. A code
 *   can be reassigned over time; the row flagged RBCS_Latest_Assignment=1
 *   is used for every year, so trends compare like with like.
 * No API key, no auth.
 *
 * Storage: one compact file per data year under years/ (rows as arrays,
 * whole dollars - the first version stored objects and came to 31MB for
 * 12 years), code descriptions once under codes.json, the category map
 * under rbcs.json, and a dated manifest of content hashes under
 * snapshots/ for the reasoning change gate.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fetchYearDatasetIds } from "./physicianByProviderSummary";

export const SOURCE_ID = "cms:medicare-physician-by-service";
export const DATASET_NAME = "medicare-physician-by-service-summary";
const SERVICE_CATALOG_TITLE = "Medicare Physician & Other Practitioners - by Geography and Service";
const RBCS_CATALOG_TITLE = "Restructured BETOS Classification System";
const API_BASE = "https://data.cms.gov/data-api/v1/dataset";
const PAGE_SIZE = 5000;
const SERVICE_COLUMNS = [
  "HCPCS_Cd",
  "HCPCS_Desc",
  "HCPCS_Drug_Ind",
  "Place_Of_Srvc",
  "Tot_Rndrng_Prvdrs",
  "Tot_Benes",
  "Tot_Srvcs",
  "Avg_Sbmtd_Chrg",
  "Avg_Mdcr_Alowd_Amt",
  "Avg_Mdcr_Pymt_Amt",
  "Avg_Mdcr_Stdzd_Amt",
];
const RBCS_COLUMNS = ["HCPCS_Cd", "RBCS_Cat_Desc", "RBCS_Subcat_Desc", "RBCS_Latest_Assignment"];

const DATA_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME);
const YEARS_DIR = path.join(DATA_DIR, "years");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");
const RBCS_FILE = path.join(DATA_DIR, "rbcs.json");
const CODES_FILE = path.join(DATA_DIR, "codes.json");

/** Column order of each stored row; descriptions live in codes.json. */
const STORED_COLUMNS = [
  "code",
  "isDrug",
  "services",
  "beneficiaries",
  "submittedCharges",
  "allowedAmount",
  "medicarePayment",
  "standardizedPayment",
  "facilityPayment",
] as const;
type StoredRow = [string, 0 | 1, number, number, number, number, number, number, number];

interface StoredYear {
  dataset: string;
  dataYear: number;
  datasetId: string;
  columns: readonly string[];
  rows: StoredRow[];
}

function toStored(year: ServiceYearData): StoredYear {
  const r = Math.round;
  return {
    dataset: year.dataset,
    dataYear: year.dataYear,
    datasetId: year.datasetId,
    columns: STORED_COLUMNS,
    rows: year.services.map((s) => [
      s.code,
      s.isDrug ? 1 : 0,
      r(s.services),
      r(s.beneficiaries),
      r(s.submittedCharges),
      r(s.allowedAmount),
      r(s.medicarePayment),
      r(s.standardizedPayment),
      r(s.facilityPayment),
    ]),
  };
}

function fromStored(stored: StoredYear, descriptions: Record<string, string>): ServiceYearData {
  return {
    dataset: stored.dataset,
    dataYear: stored.dataYear,
    datasetId: stored.datasetId,
    services: stored.rows.map(([code, isDrug, services, beneficiaries, submittedCharges, allowedAmount, medicarePayment, standardizedPayment, facilityPayment]) => ({
      code,
      description: descriptions[code] ?? "",
      isDrug: isDrug === 1,
      services,
      beneficiaries,
      submittedCharges,
      allowedAmount,
      medicarePayment,
      standardizedPayment,
      facilityPayment,
    })),
  };
}

export interface ServiceRow {
  code: string;
  description: string;
  /** CMS's HCPCS_Drug_Ind: a Part B drug billed by the practitioner (units of drug, not visits). */
  isDrug: boolean;
  services: number;
  /** Summed across the two places of service, so a beneficiary seen in both counts twice. */
  beneficiaries: number;
  submittedCharges: number;
  allowedAmount: number;
  medicarePayment: number;
  standardizedPayment: number;
  /** Medicare payment for services in a facility setting (hospital, ASC) rather than an office. */
  facilityPayment: number;
}

export interface ServiceYearData {
  dataset: string;
  dataYear: number;
  datasetId: string;
  services: ServiceRow[];
}

export interface RbcsEntry {
  category: string;
  subcategory: string;
}

type RawRow = Record<string, string | undefined>;

function num(value: string | undefined): number {
  const n = Number(value);
  return value === undefined || value === "" || Number.isNaN(n) ? 0 : n;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Combines each code's facility and office rows into one national total. Exported for tests. */
export function summarizeServiceRows(rows: RawRow[], dataYear: number, datasetId: string): ServiceYearData {
  const byCode = new Map<string, ServiceRow>();
  for (const row of rows) {
    const code = row.HCPCS_Cd;
    if (!code) continue;
    const services = num(row.Tot_Srvcs);
    const entry =
      byCode.get(code) ??
      ({
        code,
        description: row.HCPCS_Desc ?? "",
        isDrug: row.HCPCS_Drug_Ind === "Y",
        services: 0,
        beneficiaries: 0,
        submittedCharges: 0,
        allowedAmount: 0,
        medicarePayment: 0,
        standardizedPayment: 0,
        facilityPayment: 0,
      } satisfies ServiceRow);
    const payment = num(row.Avg_Mdcr_Pymt_Amt) * services;
    entry.services += services;
    entry.beneficiaries += num(row.Tot_Benes);
    entry.submittedCharges += num(row.Avg_Sbmtd_Chrg) * services;
    entry.allowedAmount += num(row.Avg_Mdcr_Alowd_Amt) * services;
    entry.medicarePayment += payment;
    entry.standardizedPayment += num(row.Avg_Mdcr_Stdzd_Amt) * services;
    if (row.Place_Of_Srvc === "F") entry.facilityPayment += payment;
    byCode.set(code, entry);
  }
  const services = [...byCode.values()]
    .map((s) => ({
      ...s,
      services: round2(s.services),
      submittedCharges: round2(s.submittedCharges),
      allowedAmount: round2(s.allowedAmount),
      medicarePayment: round2(s.medicarePayment),
      standardizedPayment: round2(s.standardizedPayment),
      facilityPayment: round2(s.facilityPayment),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
  return { dataset: DATASET_NAME, dataYear, datasetId, services };
}

/** Code -> its latest RBCS category. Exported for tests. */
export function buildRbcsMap(rows: RawRow[]): Record<string, RbcsEntry> {
  const map: Record<string, RbcsEntry> = {};
  for (const row of rows) {
    if (row.RBCS_Latest_Assignment !== "1" || !row.HCPCS_Cd) continue;
    map[row.HCPCS_Cd] = { category: row.RBCS_Cat_Desc ?? "Unclassified", subcategory: row.RBCS_Subcat_Desc ?? "Unclassified" };
  }
  return map;
}

async function fetchJson(url: string, attempt = 1): Promise<RawRow[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as RawRow[];
  } catch (err) {
    if (attempt >= 6) throw new Error(`CMS data-api request failed after ${attempt} attempts (${url}): ${err}`);
    await new Promise((r) => setTimeout(r, Math.min(5000 * 2 ** (attempt - 1), 60_000)));
    return fetchJson(url, attempt + 1);
  }
}

/** Every row matching `query`, paged until a short page comes back. */
async function fetchAll(datasetId: string, query: string): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await fetchJson(`${API_BASE}/${datasetId}/data?size=${PAGE_SIZE}&offset=${offset}&${query}`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function hashFile(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function yearFile(year: number): string {
  return path.join(YEARS_DIR, `${year}.json`);
}

/** Pulls every data year not yet on disk and refreshes the category map. Writes a dated manifest. */
export async function fetchAndSnapshot(log: (msg: string) => void = console.log): Promise<string> {
  const yearIds = await fetchYearDatasetIds(SERVICE_CATALOG_TITLE);
  const years = [...yearIds.keys()].sort();
  fs.mkdirSync(YEARS_DIR, { recursive: true });

  for (const year of years) {
    if (fs.existsSync(yearFile(year))) continue;
    const id = yearIds.get(year)!;
    const rows = await fetchAll(id, `filter%5BRndrng_Prvdr_Geo_Lvl%5D=National&column=${SERVICE_COLUMNS.join(",")}`);
    const summary = summarizeServiceRows(rows, year, id);
    fs.writeFileSync(yearFile(year), JSON.stringify(toStored(summary)));
    // Later years overwrite earlier ones, so each code keeps its most recent description.
    const codes = loadCodeDescriptions();
    for (const svc of summary.services) codes[svc.code] = svc.description;
    fs.writeFileSync(CODES_FILE, JSON.stringify(codes));
    log(`[service-summary] ${year}: ${summary.services.length} codes from ${rows.length} national rows`);
  }

  const rbcsIds = await fetchYearDatasetIds(RBCS_CATALOG_TITLE);
  const rbcsId = rbcsIds.get(Math.max(...rbcsIds.keys()));
  if (!rbcsId) throw new Error("No RBCS dataset found in the CMS catalog");
  const rbcs = buildRbcsMap(await fetchAll(rbcsId, `column=${RBCS_COLUMNS.join(",")}`));
  fs.writeFileSync(RBCS_FILE, JSON.stringify(rbcs));
  log(`[service-summary] RBCS: ${Object.keys(rbcs).length} codes classified`);

  const manifest = {
    dataset: DATASET_NAME,
    pulledAt: new Date().toISOString(),
    rbcs: hashFile(RBCS_FILE),
    codes: hashFile(CODES_FILE),
    years: Object.fromEntries(years.filter((y) => fs.existsSync(yearFile(y))).map((y) => [String(y), hashFile(yearFile(y))])),
  };
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const file = path.join(SNAPSHOTS_DIR, `${manifest.pulledAt.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return file;
}

function loadCodeDescriptions(file: string = CODES_FILE): Record<string, string> {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, string>) : {};
}

/** Every summarized data year on disk, oldest first. */
export function loadAllServiceYears(dir: string = YEARS_DIR, codesFile: string = CODES_FILE): ServiceYearData[] {
  if (!fs.existsSync(dir)) return [];
  const descriptions = loadCodeDescriptions(codesFile);
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort()
    .map((f) => fromStored(JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as StoredYear, descriptions));
}

export function loadRbcsMap(file: string = RBCS_FILE): Record<string, RbcsEntry> {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, RbcsEntry>) : {};
}
