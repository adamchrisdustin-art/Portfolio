/**
 * CMS Marketplace Open Enrollment Period (OEP) State-Level Public Use
 * Files - plan selections, average premiums before and after subsidy,
 * and enrollee mix for every state and DC, HealthCare.gov and
 * state-based exchanges alike. Added 2026-09-25: the Rate PUF
 * (marketplaceRatePuf.ts) only covers HealthCare.gov states, and has no
 * enrollment at all (Q066).
 *
 * Verified live 2026-09-25:
 * - https://www.cms.gov/data-research/statistics-trends-and-reports/marketplace-products
 *   links one page per open enrollment period (2015-2026), each linking a
 *   state-level zip.
 * - 2020 onward the zip holds a CSV: one row per state (51 including DC)
 *   with its platform (HC.gov, or SBE - labeled SBM in 2021-2024), plus Total rows for HC.gov, SBE and
 *   All. 82 columns are common to 2020-2026; 2026 has 108.
 * - 2017-2019 ship as multi-tab Excel report workbooks (read since
 *   2026-09-25 by parseStateWorkbook via xlsx.ts). They keep only the 7
 *   columns with a clear 2020+ equivalent: plan selections, new
 *   consumers, re-enrollees (total, active, automatic) and average
 *   premium before and after subsidy. Their totals use "HC.gov Platform"
 *   and "All Platforms"; the SBE-FP subtotal (a subset of HC.gov) is
 *   skipped. 2015-2016 publish no state-level file.
 * - Numbers are formatted text ("22,903", "$1,043 "). Cells are marked
 *   "*" (suppressed small count), "+" (not applicable) or "NR" (not
 *   reported, common in SBE totals); all three are stored as null, never 0.
 *
 * "Consumers" (Cnsmr) are plan selections during open enrollment, not
 * effectuated (paid) enrollment, which CMS reports separately and later.
 *
 * Storage: one file per plan year under years/ (every column, as numbers),
 * and a dated manifest of content hashes under snapshots/.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { parseCsv } from "./csv";
import { readWorkbook } from "./xlsx";

export const SOURCE_ID = "cms:marketplace-oep-state";
export const DATASET_NAME = "marketplace-oep-state";
const CMS_ORIGIN = "https://www.cms.gov";
const INDEX_URL = `${CMS_ORIGIN}/data-research/statistics-trends-and-reports/marketplace-products`;
const YEAR_PAGE_PATTERN = /href="(\/data-research\/[^"]*\/(\d{4})-marketplace-open-enrollment-period-public-use-files)"/g;
const STATE_ZIP_PATTERN = /href="([^"]*(?:state-level|statelevel|_state)[^"]*\.zip)"/i;
const FETCH_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; healthcare-intelligence-dashboard/1.0)" };
const SUPPRESSION_MARKERS = new Set(["*", "+", "NR"]);

const DATA_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME);
const YEARS_DIR = path.join(DATA_DIR, "years");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");

export interface OepRow {
  /** Two-letter code, or "Total" for the platform totals. */
  state: string;
  /** "HC.gov" or "SBE" for a state; "HC.gov", "SBE" or "All" for a Total row. */
  platform: string;
  /** Aligned with the year's `columns`; null where CMS suppressed or didn't report the cell. */
  values: (number | null)[];
}

export interface OepYear {
  dataset: string;
  planYear: number;
  sourceUrl: string;
  pulledAt: string;
  columns: string[];
  suppressedCells: number;
  rows: OepRow[];
}

/**
 * 2017-2019 workbook columns kept, by tab number and header text (lowercased,
 * hyphens and extra spaces removed), mapped to the CSV names 2020+ uses.
 * Only the columns with a clear 2020+ equivalent are kept.
 */
const WORKBOOK_COLUMNS: { tab: string; header: RegExp; column: string; decimals?: number }[] = [
  { tab: "(2)", header: /^total number of consumers who have selected an? (marketplace|exchange) plan$/, column: "Cnsmr" },
  { tab: "(2)", header: /^new consumers$/, column: "New_Cnsmr" },
  { tab: "(2)", header: /^total reenrollees$/, column: "Tot_Renrl" },
  { tab: "(2)", header: /^active reenrollees$/, column: "Actv_Renrl" },
  { tab: "(2)", header: /^automatic reenrollees$/, column: "Auto_Renrl" },
  { tab: "(5)", header: /^average premium$/, column: "Avg_Prm", decimals: 2 },
  { tab: "(5)", header: /^average premium after aptc$/, column: "Avg_Prm_Aftr_APTC", decimals: 2 },
];

const normalizeHeader = (h: string) => h.toLowerCase().replace(/-/g, "").replace(/\s+/g, " ").trim();

/** Workbook total rows: "HC.gov Platform", "SBM"/"SBE" and "All Platforms". The SBE-FP subtotal is a subset of HC.gov and is skipped. */
function workbookPlatform(state: string, raw: string): string | null {
  const text = raw.trim();
  if (state !== "Total") return normalizePlatform(text);
  if (/^HC\.gov/.test(text)) return "HC.gov";
  if (text === "SBM" || text === "SBE") return "SBE";
  if (text === "All Platforms") return "All";
  return null;
}

/** Parses one 2017-2019 state-level report workbook into the same shape as the 2020+ CSVs. Exported for tests. */
export function parseStateWorkbook(data: Uint8Array, planYear: number, sourceUrl: string): OepYear {
  const workbook = readWorkbook(data);
  const columns = WORKBOOK_COLUMNS.map((c) => c.column);
  const byKey = new Map<string, OepRow>();
  let suppressedCells = 0;
  for (const tab of [...new Set(WORKBOOK_COLUMNS.map((c) => c.tab))]) {
    const sheetName = workbook.sheetNames.find((n) => n.startsWith(tab));
    if (!sheetName) throw new Error(`OEP ${planYear} workbook has no ${tab} tab - sheets were: ${workbook.sheetNames.join(", ")}`);
    const [header, ...body] = workbook.sheet(sheetName);
    const headers = header.map(normalizeHeader);
    const wanted = WORKBOOK_COLUMNS.filter((c) => c.tab === tab).map((c) => {
      const index = headers.findIndex((h) => c.header.test(h));
      if (index === -1) throw new Error(`OEP ${planYear} ${sheetName}: no column matching ${c.header} - header was: ${header.join(", ")}`);
      return { ...c, index };
    });
    for (const row of body) {
      const state = row[1]?.trim();
      if (!state || !(/^[A-Z]{2}$/.test(state) || state === "Total")) continue; // footnotes and blank rows
      const platform = workbookPlatform(state, row[2] ?? "");
      if (!platform) continue;
      const key = `${state}|${platform}`;
      if (!byKey.has(key)) byKey.set(key, { state, platform, values: columns.map(() => null) });
      for (const c of wanted) {
        if (SUPPRESSION_MARKERS.has((row[c.index] ?? "").trim())) suppressedCells++;
        const value = parseCell(row[c.index]);
        byKey.get(key)!.values[columns.indexOf(c.column)] = value === null || c.decimals === undefined ? value : Number(value.toFixed(c.decimals));
      }
    }
  }
  const rows = [...byKey.values()];
  const states = rows.filter((r) => r.state !== "Total");
  if (states.length < 51) throw new Error(`OEP ${planYear}: expected 51 states and DC, found ${states.length}`);
  return { dataset: DATASET_NAME, planYear, sourceUrl, pulledAt: new Date().toISOString(), columns, suppressedCells, rows };
}

/** "22,903" -> 22903, "$1,043 " -> 1043, "12.5%" -> 12.5; markers and blanks -> null. Exported for tests. */
export function parseCell(raw: string | undefined): number | null {
  const text = (raw ?? "").trim();
  if (!text || SUPPRESSION_MARKERS.has(text)) return null;
  const n = Number(text.replace(/[$,%\s]/g, ""));
  return Number.isNaN(n) ? null : n;
}

/** CMS labels state-run exchanges "SBM" (2021-2024) or "SBE" (other years); stored as "SBE". */
const normalizePlatform = (raw: string) => (raw.trim() === "SBM" ? "SBE" : raw.trim());

/** Parses one state-level CSV. Exported for tests. */
export function parseStateCsv(text: string, planYear: number, sourceUrl: string): OepYear {
  const table = parseCsv(text.replace(/^﻿/, ""));
  const header = table[0].map((h) => h.replace(/^﻿/, "").trim());
  const stateCol = header.indexOf("State_Abrvtn");
  const platformCol = header.indexOf("Pltfrm");
  if (stateCol === -1 || platformCol === -1 || !header.includes("Cnsmr")) {
    throw new Error(`OEP ${planYear} state-level file is missing State_Abrvtn, Pltfrm or Cnsmr - header was: ${header.join(", ")}`);
  }
  const valueCols = header.map((h, i) => ({ h, i })).filter(({ h, i }) => h && i !== stateCol && i !== platformCol);
  let suppressedCells = 0;
  const rows: OepRow[] = [];
  for (const row of table.slice(1)) {
    const state = row[stateCol]?.trim();
    if (!state) continue; // trailing blank rows
    const values = valueCols.map(({ i }) => {
      if (SUPPRESSION_MARKERS.has((row[i] ?? "").trim())) suppressedCells++;
      return parseCell(row[i]);
    });
    rows.push({ state, platform: normalizePlatform(row[platformCol]), values });
  }
  const states = rows.filter((r) => r.state !== "Total");
  if (states.length < 51) throw new Error(`OEP ${planYear}: expected 51 states and DC, found ${states.length}`);
  return { dataset: DATASET_NAME, planYear, sourceUrl, pulledAt: new Date().toISOString(), columns: valueCols.map((c) => c.h), suppressedCells, rows };
}

/** A column's value for a row, or null when the column doesn't exist that year or the cell is suppressed. */
export function valueOf(year: OepYear, row: OepRow, column: string): number | null {
  const i = year.columns.indexOf(column);
  return i === -1 ? null : row.values[i];
}

export const stateRows = (year: OepYear) => year.rows.filter((r) => r.state !== "Total");
export const totalRow = (year: OepYear, platform: "HC.gov" | "SBE" | "All") => year.rows.find((r) => r.state === "Total" && r.platform === platform) ?? null;

async function fetchWithRetry(url: string, attempt = 1): Promise<Response> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res;
  } catch (err) {
    if (attempt >= 5) throw new Error(`CMS OEP download failed after ${attempt} attempts (${url}): ${err}`, { cause: err });
    await new Promise((r) => setTimeout(r, 5000 * 2 ** (attempt - 1)));
    return fetchWithRetry(url, attempt + 1);
  }
}

/** Open enrollment year -> its page on cms.gov. */
export async function listYearPages(): Promise<Map<number, string>> {
  const html = await (await fetchWithRetry(INDEX_URL)).text();
  const pages = new Map<number, string>();
  for (const m of html.matchAll(YEAR_PAGE_PATTERN)) pages.set(Number(m[2]), `${CMS_ORIGIN}${m[1]}`);
  if (pages.size === 0) throw new Error(`No open enrollment PUF pages linked from ${INDEX_URL} - page structure may have changed`);
  return pages;
}

/** The year's state-level file (CSV from 2020, report workbook for 2017-2019), or null when the year has none. */
async function pullYear(year: number, pageUrl: string, log: (msg: string) => void): Promise<OepYear | null> {
  const html = await (await fetchWithRetry(pageUrl)).text();
  const href = html.match(STATE_ZIP_PATTERN)?.[1];
  if (!href) {
    log(`[oep] ${year}: no state-level file on the year's page`);
    return null;
  }
  const url = href.startsWith("http") ? href : `${CMS_ORIGIN}${href}`;
  const files = unzipSync(new Uint8Array(await (await fetchWithRetry(url)).arrayBuffer()));
  const csv = Object.keys(files).find((n) => n.toLowerCase().endsWith(".csv"));
  if (csv) return parseStateCsv(Buffer.from(files[csv]).toString("utf-8"), year, url);
  const xlsx = Object.keys(files).find((n) => n.toLowerCase().endsWith(".xlsx"));
  if (xlsx) return parseStateWorkbook(files[xlsx], year, url);
  log(`[oep] ${year}: state-level file has no CSV or .xlsx, skipped`);
  return null;
}

const yearFile = (year: number) => path.join(YEARS_DIR, `${year}.json`);
const hashFile = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const loadYear = (file: string) => JSON.parse(fs.readFileSync(file, "utf-8")) as OepYear;

/** Pulls every year not yet on disk and re-checks the newest (CMS revises it). Writes a dated manifest. */
export async function fetchAndSnapshot(log: (msg: string) => void = console.log): Promise<string> {
  const pages = await listYearPages();
  const years = [...pages.keys()].sort();
  const newest = years[years.length - 1];
  fs.mkdirSync(YEARS_DIR, { recursive: true });
  for (const year of years) {
    if (year !== newest && fs.existsSync(yearFile(year))) continue;
    const summary = await pullYear(year, pages.get(year)!, log);
    if (!summary) continue;
    const previous = fs.existsSync(yearFile(year)) ? loadYear(yearFile(year)) : null;
    if (previous && JSON.stringify({ ...previous, pulledAt: "" }) === JSON.stringify({ ...summary, pulledAt: "" })) {
      log(`[oep] ${year}: unchanged`);
      continue;
    }
    fs.writeFileSync(yearFile(year), JSON.stringify(summary));
    log(`[oep] ${year}: ${stateRows(summary).length} states, ${summary.columns.length} columns, ${summary.suppressedCells} suppressed cells`);
  }
  const onDisk = years.filter((y) => fs.existsSync(yearFile(y)));
  const manifest = { dataset: DATASET_NAME, pulledAt: new Date().toISOString(), years: Object.fromEntries(onDisk.map((y) => [String(y), hashFile(yearFile(y))])) };
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const file = path.join(SNAPSHOTS_DIR, `${manifest.pulledAt.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return file;
}

/** Every open enrollment year on disk, oldest first. */
export function loadAllOepYears(dir: string = YEARS_DIR): OepYear[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort()
    .map((f) => loadYear(path.join(dir, f)));
}
