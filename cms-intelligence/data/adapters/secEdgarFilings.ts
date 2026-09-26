/**
 * SEC EDGAR "submissions" API - real 8-K filing activity for a hardcoded
 * watchlist of publicly traded health insurers, the first real data
 * source for the 12th agent, Market/Catalyst Intelligence (see
 * cms-intelligence/agents/market-catalyst/agent.ts). This is a
 * fundamentally different source family from every other adapter in this
 * repo - corporate-disclosure events, not a CMS program dataset - added
 * per Adam's 2026-09-24 direction to give this dashboard a real
 * market-catalyst/corporate-activity layer.
 *
 * Verified live 2026-09-24 via a real query against the endpoint below
 * for UnitedHealth Group's CIK (not assumed by analogy to any other
 * source, per the master orchestrator's "never invent a source" rule):
 *   https://data.sec.gov/submissions/CIK0000731766.json
 * Confirmed real response shape: a top-level `filings.recent` object of
 * PARALLEL ARRAYS (not an array of objects) - `form`, `filingDate`,
 * `reportDate`, `items` (a comma-separated string of item codes, e.g.
 * "5.02,9.01" - not an array), `accessionNumber`, `primaryDocument`, all
 * indexed by the same position. No API key or auth required, but SEC's
 * own fair-access documentation (https://www.sec.gov/os/webmaster-faq#code-support)
 * requires a descriptive User-Agent with a real contact - this is a real,
 * documented SEC requirement, not optional, and this adapter sends one.
 *
 * Real CIKs below were each independently verified live (not guessed)
 * against this same endpoint on 2026-09-24 - each returned the correct
 * company name back in the response body.
 *
 * IMPORTANT NAMING/HONESTY RULE (see this project's CLAUDE.md and
 * AGENT_ARCHITECTURE.md's revised 2026-09-24 real-carrier-naming rule,
 * and the market-catalyst agent's own file header for the fuller
 * rationale): SEC Form 8-K Item 5.02 covers BOTH departure AND
 * appointment of officers/directors - this adapter and every consumer of
 * it must never say "fired" or "resigned," only "filed an 8-K Item 5.02
 * (departure or election of directors/principal officers)." Item 1.01 is
 * "entry into a material definitive agreement" - covers far more than
 * partnerships (credit facilities, leases, etc.) - never say "announced a
 * partnership."
 */
import fs from "node:fs";
import path from "node:path";

export const SOURCE_ID = "sec-edgar:healthcare-8k-filings";
const DATASET_NAME = "sec-edgar-healthcare-filings";
// Widened 2026-09-24 from 150 to 730 days (real 2-year window) per
// Adam's request for deeper real historical coverage. Verified live
// 2026-09-24: UnitedHealth Group's real "recent" filings array alone
// (this endpoint's real, undocumented-length recent-filings page, capped
// at ~1000 filings of ANY form type, not just 8-Ks) already reaches back
// to 2020-12-17 - comfortably covering 730 days without needing the
// real older-filings pagination this endpoint also exposes (the
// `filings.files` array) for any of this project's 6 actively-filing
// tracked companies.
export const WINDOW_DAYS = 730;
const REQUEST_DELAY_MS = 150; // SEC's documented rate-limit courtesy ask (~10 req/s ceiling; this is far under that)
export const USER_AGENT = "healthcare-intelligence-dashboard adamdustin.me (adam.chris.dustin@gmail.com)";

const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");

export interface TrackedCompany {
  cik: string; // unpadded, as commonly written - padded to 10 digits when building the request URL
  name: string;
}

/** Verified live 2026-09-24 against data.sec.gov/submissions/CIK{...}.json - each CIK confirmed to return this exact company name. */
export const TRACKED_COMPANIES: TrackedCompany[] = [
  { cik: "731766", name: "UnitedHealth Group, Inc." },
  { cik: "64803", name: "CVS Health Corporation" },
  { cik: "49071", name: "Humana Inc." },
  { cik: "1071739", name: "Centene Corporation" },
  { cik: "1739940", name: "The Cigna Group" },
  { cik: "1156039", name: "Elevance Health, Inc." },
];

export interface SecFiling {
  cik: string;
  companyName: string;
  form: string;
  filingDate: string; // ISO date
  reportDate: string; // ISO date
  items: string[]; // e.g. ["5.02", "9.01"]
  accessionNumber: string;
  url: string;
}

export interface SecEdgarSnapshot {
  dataset: string;
  pulledAt: string;
  windowStart: string;
  filings: SecFiling[];
}

/** A submissions response's `filings.recent` block; each older page listed in `filings.files` has the same parallel-array shape. */
export interface RawRecentFilings {
  form: string[];
  filingDate: string[];
  reportDate: string[];
  items: string[];
  accessionNumber: string[];
  primaryDocument: string[];
}

export interface RawSubmissionsResponse {
  name?: string;
  sic?: string;
  filings: {
    recent: RawRecentFilings;
    files?: { name: string; filingFrom: string; filingTo: string }[];
  };
}

function windowStartDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
}

export function padCik(cik: string): string {
  return cik.padStart(10, "0");
}

export function filingUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
  const cikNoLeadingZeros = String(Number(cik));
  const accessionNoDashes = accessionNumber.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${accessionNoDashes}/${primaryDocument}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCompanyFilings(company: TrackedCompany, windowStart: string): Promise<SecFiling[]> {
  const url = `https://data.sec.gov/submissions/CIK${padCik(company.cik)}.json`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`SEC EDGAR submissions query failed for ${company.name} (CIK ${company.cik}): ${res.status} ${res.statusText} (${url})`);
  }
  const body = (await res.json()) as RawSubmissionsResponse;
  return recent8KFilings(body.filings.recent, company.cik, company.name, windowStart);
}

/** Original 8-Ks (8-K/A amendments excluded) filed on or after windowStart, from one parallel-array block of a submissions response. */
export function recent8KFilings(recent: RawRecentFilings, cik: string, companyName: string, windowStart: string): SecFiling[] {
  const out: SecFiling[] = [];
  for (let i = 0; i < recent.form.length; i++) {
    if (recent.form[i] !== "8-K") continue;
    if (recent.filingDate[i] < windowStart) continue;
    out.push({
      cik,
      companyName,
      form: recent.form[i],
      filingDate: recent.filingDate[i],
      reportDate: recent.reportDate[i],
      items: recent.items[i] ? recent.items[i].split(",").map((s) => s.trim()).filter(Boolean) : [],
      accessionNumber: recent.accessionNumber[i],
      url: filingUrl(cik, recent.accessionNumber[i], recent.primaryDocument[i]),
    });
  }
  return out;
}

/** Live pull + snapshot to disk - run manually/on schedule, never from a page load (COST_AND_OPERATING_MODEL.md). */
export async function fetchAndSnapshot(): Promise<string> {
  const windowStart = windowStartDate();
  const filings: SecFiling[] = [];
  for (const company of TRACKED_COMPANIES) {
    const companyFilings = await fetchCompanyFilings(company, windowStart);
    filings.push(...companyFilings);
    await sleep(REQUEST_DELAY_MS);
  }

  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(SNAPSHOTS_DIR, `${stamp}.json`);
  const snapshot: SecEdgarSnapshot = {
    dataset: DATASET_NAME,
    pulledAt: new Date().toISOString(),
    windowStart,
    filings,
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

export function loadSnapshot(file: string): SecEdgarSnapshot {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as SecEdgarSnapshot;
}

/** Returns null (never throws) when no snapshot exists yet - callers must treat that as "no data available." */
export function loadLatestSnapshot(): SecEdgarSnapshot | null {
  const file = latestSnapshotFile();
  if (!file) return null;
  return loadSnapshot(file);
}
