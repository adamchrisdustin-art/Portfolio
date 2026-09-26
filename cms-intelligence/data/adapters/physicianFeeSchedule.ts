/**
 * CMS Physician Fee Schedule national relative value (RVU) files - the
 * published price of every Part B service, each year from 2013. Added
 * 2026-09-25 so the reimbursement agent can read fee-schedule price
 * changes against the claims volumes in physicianServiceSummary.ts
 * (both keyed by HCPCS code).
 *
 * Verified live 2026-09-25:
 * - CMS's index page (INDEX_URL) links one page per quarterly release,
 *   anchor text "RVU26D", "RVU24AR" and so on, back to 2003. The hrefs use
 *   several URL layouts, including malformed-looking ones for 2020-2022
 *   ("/medicaremedicare-fee-service-payment...") that do resolve, so links
 *   are followed exactly as published.
 * - Each release page links one zip (2026: /files/zip/rvu26d-updated-
 *   08-26-2026.zip). Inside, the national file is PPRRVU*.csv; from 2026
 *   there are two, _nonQPP and _QPP (two conversion factors), and the
 *   nonQPP one is used for every year.
 * - About nine rows of titles and a split header sit above the data, and
 *   2026 added a column, so columns are found by the two header rows
 *   joined ("NON-FACILITY" + "TOTAL"), never by position. 2013 uses bare
 *   CR line endings.
 * - The conversion factor is a column on every row (33.4009 for 2026
 *   nonQPP, 34.023 for 2013).
 * No API key, no login.
 *
 * The latest release of each year is used (D, October, when it exists):
 * the rates in effect at year end, including mid-year corrections such as
 * 2024's March conversion-factor change.
 *
 * CPT descriptions are copyright the American Medical Association, so
 * this adapter stores codes and numbers only, never the description
 * column.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { parseCsv } from "./csv";

export const SOURCE_ID = "cms:physician-fee-schedule";
export const DATASET_NAME = "physician-fee-schedule-rvu";
export const INDEX_URL = "https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files";
const CMS_ORIGIN = "https://www.cms.gov";
const FIRST_YEAR = 2013;

const DATA_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME);
const YEARS_DIR = path.join(DATA_DIR, "years");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");

/** One code's national prices in RVUs. Multiply by the year's conversion factor for dollars. */
export interface FeeRow {
  code: string;
  statusCode: string;
  nonFacilityTotalRvu: number;
  facilityTotalRvu: number;
}

export interface FeeScheduleYear {
  dataset: string;
  year: number;
  /** e.g. "RVU26D" */
  release: string;
  zipUrl: string;
  fileName: string;
  conversionFactor: number;
  rows: FeeRow[];
}

type StoredRow = [string, string, number, number];
interface StoredYear extends Omit<FeeScheduleYear, "rows"> {
  columns: readonly string[];
  rows: StoredRow[];
}
const STORED_COLUMNS = ["code", "statusCode", "nonFacilityTotalRvu", "facilityTotalRvu"] as const;

export interface ReleaseLink {
  year: number;
  release: string;
  url: string;
}

const RELEASE_LINK = /href="([^"]+)"[^>]*>\s*(RVU(\d{2})([A-D])([A-Z0-9_]*))\s*</g;

/** The latest release page per year from the index HTML. Exported for tests. */
export function latestReleasePerYear(indexHtml: string): Map<number, ReleaseLink> {
  const byYear = new Map<number, ReleaseLink & { rank: string }>();
  for (const m of indexHtml.matchAll(RELEASE_LINK)) {
    const [, href, release, yy, letter, suffix] = m;
    if (suffix.includes("PCT")) continue;
    const year = 2000 + Number(yy);
    if (year < FIRST_YEAR) continue;
    const rank = `${letter}${suffix}`;
    const current = byYear.get(year);
    if (!current || rank > current.rank) {
      byYear.set(year, { year, release, url: href.startsWith("http") ? href : `${CMS_ORIGIN}${href}`, rank });
    }
  }
  return new Map([...byYear].map(([y, { rank: _rank, ...link }]) => [y, link]));
}

/** The national PPRRVU csv in a release zip; the nonQPP one when a year has two. */
export function pickRvuFile(names: string[]): string | undefined {
  const csvs = names.filter((n) => /^PPRRVU.*\.csv$/i.test(path.basename(n)));
  return csvs.find((n) => !/_QPP\.csv$/i.test(path.basename(n)));
}

/**
 * Parses a PPRRVU csv: global rows only (no modifier) with a nonzero price, codes and numbers only.
 * Exported for tests.
 */
export function parseRvuCsv(text: string): { conversionFactor: number; rows: FeeRow[] } {
  const table = parseCsv(text);
  const h = table.findIndex((r) => r[0]?.trim().toUpperCase() === "HCPCS");
  if (h < 1) throw new Error("PPRRVU header row (HCPCS) not found");
  const names = table[h].map((cell, i) => [table[h - 1][i] ?? "", cell].map((s) => s.trim().toUpperCase()).filter(Boolean).join(" "));
  const col = (name: string) => {
    const i = names.indexOf(name);
    if (i < 0) throw new Error(`PPRRVU column "${name}" not found (have: ${names.join(" | ")})`);
    return i;
  };
  const [code, mod, status, nonFac, fac, cf] = ["HCPCS", "MOD", "STATUS CODE", "NON-FACILITY TOTAL", "FACILITY TOTAL", "CONV FACTOR"].map(col);
  const rows: FeeRow[] = [];
  const factors = new Map<number, number>();
  for (const r of table.slice(h + 1)) {
    const hcpcs = r[code]?.trim();
    if (!hcpcs || r[mod]?.trim()) continue;
    const factor = Number(r[cf]);
    if (factor > 0) factors.set(factor, (factors.get(factor) ?? 0) + 1);
    const nonFacilityTotalRvu = Number(r[nonFac]) || 0;
    const facilityTotalRvu = Number(r[fac]) || 0;
    // Anesthesia, drugs and non-payable codes carry no RVUs; they aren't priced by this file.
    if (nonFacilityTotalRvu === 0 && facilityTotalRvu === 0) continue;
    rows.push({ code: hcpcs, statusCode: r[status]?.trim() ?? "", nonFacilityTotalRvu, facilityTotalRvu });
  }
  // Every row carries the same factor; the most common one guards against a stray value.
  const conversionFactor = [...factors].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!conversionFactor) throw new Error("No conversion factor found in PPRRVU file");
  return { conversionFactor, rows: rows.sort((a, b) => a.code.localeCompare(b.code)) };
}

async function fetchWithRetry(url: string, attempt = 1): Promise<Response> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res;
  } catch (err) {
    if (attempt >= 5) throw new Error(`CMS fee schedule download failed after ${attempt} attempts (${url}): ${err}`, { cause: err });
    await new Promise((r) => setTimeout(r, 5000 * 2 ** (attempt - 1)));
    return fetchWithRetry(url, attempt + 1);
  }
}

const yearFile = (year: number) => path.join(YEARS_DIR, `${year}.json`);

function readStored(year: number): StoredYear | null {
  return fs.existsSync(yearFile(year)) ? (JSON.parse(fs.readFileSync(yearFile(year), "utf-8")) as StoredYear) : null;
}

async function pullRelease(link: ReleaseLink): Promise<FeeScheduleYear> {
  const html = await (await fetchWithRetry(link.url)).text();
  const href = html.match(/href="([^"]+\.zip)"/i)?.[1];
  if (!href) throw new Error(`No zip linked from ${link.release} page ${link.url}`);
  const zipUrl = href.startsWith("http") ? href : `${CMS_ORIGIN}${href}`;
  const files = unzipSync(new Uint8Array(await (await fetchWithRetry(zipUrl)).arrayBuffer()));
  const fileName = pickRvuFile(Object.keys(files));
  if (!fileName) throw new Error(`No PPRRVU csv in ${zipUrl} (files: ${Object.keys(files).join(", ")})`);
  const { conversionFactor, rows } = parseRvuCsv(new TextDecoder("latin1").decode(files[fileName]));
  return { dataset: DATASET_NAME, year: link.year, release: link.release, zipUrl, fileName: path.basename(fileName), conversionFactor, rows };
}

function hashFile(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** Pulls any year whose latest release isn't on disk yet (new years, and newer quarterly releases). Writes a dated manifest. */
export async function fetchAndSnapshot(log: (msg: string) => void = console.log): Promise<string> {
  const releases = latestReleasePerYear(await (await fetchWithRetry(INDEX_URL)).text());
  if (releases.size === 0) throw new Error(`No RVU release pages linked from ${INDEX_URL} - page structure may have changed`);
  fs.mkdirSync(YEARS_DIR, { recursive: true });
  for (const link of [...releases.values()].sort((a, b) => a.year - b.year)) {
    if (readStored(link.year)?.release === link.release) continue;
    const year = await pullRelease(link);
    const stored: StoredYear = { ...year, columns: STORED_COLUMNS, rows: year.rows.map((r) => [r.code, r.statusCode, r.nonFacilityTotalRvu, r.facilityTotalRvu]) };
    fs.writeFileSync(yearFile(link.year), JSON.stringify(stored));
    log(`[fee-schedule] ${link.year}: ${link.release}, ${year.fileName}, conversion factor ${year.conversionFactor}, ${year.rows.length} codes`);
  }
  const years = [...releases.keys()].filter((y) => fs.existsSync(yearFile(y))).sort();
  const manifest = {
    dataset: DATASET_NAME,
    pulledAt: new Date().toISOString(),
    years: Object.fromEntries(years.map((y) => [String(y), { release: releases.get(y)!.release, sha256: hashFile(yearFile(y)) }])),
  };
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const file = path.join(SNAPSHOTS_DIR, `${manifest.pulledAt.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return file;
}

/** Every fee schedule year on disk, oldest first. */
export function loadAllFeeScheduleYears(dir: string = YEARS_DIR): FeeScheduleYear[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort()
    .map((f) => {
      const stored = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as StoredYear;
      const { dataset, year, release, zipUrl, fileName, conversionFactor, rows } = stored;
      return { dataset, year, release, zipUrl, fileName, conversionFactor, rows: rows.map(([code, statusCode, nonFacilityTotalRvu, facilityTotalRvu]) => ({ code, statusCode, nonFacilityTotalRvu, facilityTotalRvu })) };
    });
}
