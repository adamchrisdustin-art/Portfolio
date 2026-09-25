/**
 * CMS "Monthly Enrollment by Plan" - Medicare Advantage & Part D
 * contract/plan-level enrollment. Second item in Adam's data-source
 * priority order (2026-09-23), after the Federal Register.
 *
 * Verified live 2026-09-23 by actually crawling CMS's real page
 * structure (not assumed from the Provider Data Catalog pattern the
 * other 3 CMS adapters use - a live metastore search there returned
 * zero MA/enrollment datasets, confirming this data family lives on a
 * different platform entirely):
 *   1. Index: cms.gov/.../medicare-advantagepart-d-contract-and-enrollment-data/monthly-enrollment-plan
 *      lists one real node link per report period
 *      (.../monthly-enrollment-plan-YYYY-MM).
 *   2. Each period's node page links to a real .zip
 *      (cms.gov/files/zip/monthly-enrollment-plan-<month>-<year>.zip) -
 *      confirmed by actually downloading
 *      monthly-enrollment-plan-september-2026.zip and inspecting its
 *      real contents (CSV + XLSX + a real README).
 * This adapter re-discovers the latest period's real URL at pull time
 * (rather than hardcoding "this month") specifically because the URL
 * changes every month and CMS's own page structure, not a predictable
 * pattern this code should guess at, is the source of truth - same
 * "never invent a source" discipline as every other adapter, extended to
 * a source whose exact URL isn't stable.
 *
 * NAMING/PRIVACY (binding rule, see CLAUDE.md - revised 2026-09-24): the
 * real CSV contains a named organization/plan for every row (Organization
 * Name, Organization Marketing Name, Plan Name, Parent Organization,
 * Contract Number, Plan ID) - real carriers, including UnitedHealthcare,
 * Humana, CVS/Aetna, Kaiser, etc. A real carrier name is allowed to reach
 * an insight ONLY when it is a genuine, sourced finding computed from
 * this real data (e.g. "which parent organization leads MA enrollment" -
 * the same kind of ranking a real industry directory like AIS Health
 * publishes) - never fabricated, never implied to be this project's own
 * proprietary/internal data, and never editorialized about a carrier
 * beyond what the cited number shows. This adapter therefore keeps
 * `parentOrganization` and `organizationMarketingName` (the two fields a
 * real market-share rollup needs) but still drops `Organization Name`,
 * `Plan Name`, `Contract Number`, and `Plan ID` - lower-level plan/contract
 * detail this project has no real use for and that would only add
 * unnecessary specificity to a real, aggregate, national finding.
 *
 * Suppression: CMS marks enrollment <=10 as "*" (real HIPAA-driven
 * small-cell suppression, documented in the real
 * Read_Me_Monthly_Report_By_Plan_2026.txt inside the zip itself) - those
 * rows are excluded, never imputed, same discipline as every other
 * suppression case in this project.
 */
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { parseCsv } from "./csv";

export const SOURCE_ID = "cms:ma-part-d-enrollment";
export const INDEX_URL =
  "https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-advantagepart-d-contract-and-enrollment-data/monthly-enrollment-plan";
export const INDEX_LINK_PATTERN =
  /href="(\/data-research\/statistics-trends-and-reports\/medicare-advantagepart-d-contract-and-enrollment-data\/monthly-enrollment-plan\/monthly-enrollment-plan-(\d{4}-\d{2}))"/g;
const ZIP_LINK_PATTERN = /href="(\/files\/zip\/[^"]+\.zip)"/;
const DATASET_NAME = "ma-part-d-enrollment";
const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");
// cms.gov rejects requests with no User-Agent - a real, observed requirement, not a guess.
export const FETCH_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; healthcare-intelligence-dashboard/1.0)" };

export interface MaPartDPlanRow {
  organizationType: string;
  planType: string;
  offersPartD: "Yes" | "No";
  enrollment: number;
  /** Real CMS field - the parent company (e.g. a real, named carrier) behind this plan's contract. */
  parentOrganization: string;
  /** Real CMS field - the consumer-facing brand name a plan is marketed under, which can differ from parentOrganization. */
  organizationMarketingName: string;
}

export interface MaPartDSnapshot {
  dataset: string;
  /** The real CMS report period this file covers, e.g. "2026-09" - not the pull date. */
  reportPeriod: string;
  sourceUrl: string;
  pulledAt: string;
  rowCount: number;
  /** Real rows CMS marked "*" (enrollment <=10, HIPAA suppression) and this adapter excluded rather than imputed. */
  suppressedRowCount: number;
  rows: MaPartDPlanRow[];
}

async function findLatestReportPeriod(): Promise<{ period: string; pageUrl: string }> {
  const res = await fetch(INDEX_URL, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`CMS MA/Part D index page fetch failed: ${res.status} ${res.statusText} (${INDEX_URL})`);
  const html = await res.text();

  let best: { period: string; href: string } | null = null;
  for (const m of html.matchAll(INDEX_LINK_PATTERN)) {
    const [, href, period] = m;
    if (!best || period > best.period) best = { period, href };
  }
  if (!best) throw new Error(`No monthly report period links found on CMS index page (${INDEX_URL}) - page structure may have changed`);
  return { period: best.period, pageUrl: `https://www.cms.gov${best.href}` };
}

export async function findZipUrl(pageUrl: string): Promise<string> {
  const res = await fetch(pageUrl, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`CMS MA/Part D report page fetch failed: ${res.status} ${res.statusText} (${pageUrl})`);
  const html = await res.text();
  const match = ZIP_LINK_PATTERN.exec(html);
  if (!match) throw new Error(`No .zip download link found on CMS report page (${pageUrl}) - page structure may have changed`);
  return `https://www.cms.gov${match[1]}`;
}

export function parseRows(csvText: string): { rows: MaPartDPlanRow[]; suppressedRowCount: number } {
  const table = parseCsv(csvText);
  if (table.length === 0) return { rows: [], suppressedRowCount: 0 };

  // Some months' headers carry stray whitespace (seen live: "Enrollment " in a 2024 file) or a byte-order mark.
  const header = table[0].map((h) => h.replace(/^﻿/, "").trim());
  const idx = (name: string) => header.indexOf(name);
  const orgTypeIdx = idx("Organization Type");
  const planTypeIdx = idx("Plan Type");
  const offersPartDIdx = idx("Offers Part D");
  const enrollmentIdx = idx("Enrollment");
  const parentOrgIdx = idx("Parent Organization");
  const marketingNameIdx = idx("Organization Marketing Name");
  if ([orgTypeIdx, planTypeIdx, offersPartDIdx, enrollmentIdx, parentOrgIdx, marketingNameIdx].some((i) => i === -1)) {
    throw new Error(`CMS MA/Part D CSV is missing an expected column - real header was: ${header.join(", ")}`);
  }

  const rows: MaPartDPlanRow[] = [];
  let suppressedRowCount = 0;
  for (const line of table.slice(1)) {
    const rawEnrollment = line[enrollmentIdx]?.trim();
    if (rawEnrollment === "*") {
      suppressedRowCount++;
      continue;
    }
    const enrollment = Number(rawEnrollment);
    const offersPartD = line[offersPartDIdx]?.trim();
    if (Number.isNaN(enrollment) || (offersPartD !== "Yes" && offersPartD !== "No")) continue;
    rows.push({
      organizationType: line[orgTypeIdx]?.trim() ?? "",
      planType: line[planTypeIdx]?.trim() ?? "",
      offersPartD,
      enrollment,
      parentOrganization: line[parentOrgIdx]?.trim() ?? "",
      organizationMarketingName: line[marketingNameIdx]?.trim() ?? "",
    });
  }
  return { rows, suppressedRowCount };
}

/** Downloads one report period's zip and parses its plan rows. Shared with maPartDHistory.ts. */
export async function downloadPlanRows(pageUrl: string): Promise<{ zipUrl: string; rows: MaPartDPlanRow[]; suppressedRowCount: number }> {
  const zipUrl = await findZipUrl(pageUrl);
  const zipRes = await fetch(zipUrl, { headers: FETCH_HEADERS });
  if (!zipRes.ok) throw new Error(`CMS MA/Part D zip download failed: ${zipRes.status} ${zipRes.statusText} (${zipUrl})`);
  const zipBytes = new Uint8Array(await zipRes.arrayBuffer());
  const files = unzipSync(zipBytes);

  const csvEntryName = Object.keys(files).find((n) => n.toLowerCase().endsWith(".csv"));
  if (!csvEntryName) throw new Error(`No .csv entry found inside the downloaded zip (${zipUrl})`);
  const csvText = Buffer.from(files[csvEntryName]).toString("utf-8");

  return { zipUrl, ...parseRows(csvText) };
}

/** Live pull + snapshot to disk - run manually/on schedule, never from a page load (COST_AND_OPERATING_MODEL.md). */
export async function fetchAndSnapshot(): Promise<string> {
  const { period, pageUrl } = await findLatestReportPeriod();
  const { zipUrl, rows, suppressedRowCount } = await downloadPlanRows(pageUrl);

  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(SNAPSHOTS_DIR, `${stamp}.json`);
  const snapshot: MaPartDSnapshot = {
    dataset: DATASET_NAME,
    reportPeriod: period,
    sourceUrl: zipUrl,
    pulledAt: new Date().toISOString(),
    rowCount: rows.length,
    suppressedRowCount,
    rows,
  };
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  return file;
}

export function listSnapshotFiles(): string[] {
  if (!fs.existsSync(SNAPSHOTS_DIR)) return [];
  return fs
    .readdirSync(SNAPSHOTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => path.join(SNAPSHOTS_DIR, f));
}

export function latestSnapshotFile(): string | null {
  const files = listSnapshotFiles();
  return files.length ? files[files.length - 1] : null;
}

export function loadSnapshot(file: string): MaPartDSnapshot {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as MaPartDSnapshot;
}

export function loadLatestSnapshot(): MaPartDSnapshot | null {
  const file = latestSnapshotFile();
  if (!file) return null;
  return loadSnapshot(file);
}
