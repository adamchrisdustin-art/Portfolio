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
 * - 2017-2019 ship only as multi-tab Excel report workbooks with a
 *   different layout; those years are skipped, not guessed at.
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

/** The year's state-level file, or null when the year has none or ships it only as an Excel workbook. */
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
  if (!csv) {
    log(`[oep] ${year}: state-level file is Excel only, skipped`);
    return null;
  }
  return parseStateCsv(Buffer.from(files[csv]).toString("utf-8"), year, url);
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
