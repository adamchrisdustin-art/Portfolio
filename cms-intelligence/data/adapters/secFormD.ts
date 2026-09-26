/**
 * SEC Form D data sets - private (exempt) offerings reported by
 * health-care issuers, added 2026-09-25 for the Market Catalyst agent.
 * Form D is the notice a company files within 15 days of first selling
 * securities in an offering exempt from registration (Regulation D, and
 * Section 4(a)(5)): venture and private-equity rounds, among others.
 *
 * Verified live 2026-09-25: SEC publishes one zip per quarter, linked
 * from https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets.
 * The link path changed between quarters (2026q2 is under
 * /files/datastandardsinnovation/..., earlier ones under
 * /files/structureddata/...), so the adapter reads the links from that
 * page each pull instead of building them. Each zip holds tab-separated
 * files joined by ACCESSIONNUMBER; three are used:
 *   - FORMDSUBMISSION.tsv: FILING_DATE ("30-JUN-2026"), SUBMISSIONTYPE
 *     (D or D/A), TESTORLIVE
 *   - OFFERING.tsv: INDUSTRYGROUPTYPE, ISAMENDMENT,
 *     PREVIOUSACCESSIONNUMBER, TOTALOFFERINGAMOUNT, TOTALAMOUNTSOLD
 *   - ISSUERS.tsv: ENTITYNAME, CIK, STATEORCOUNTRY(DESCRIPTION) for the
 *     primary issuer (IS_PRIMARYISSUER_FLAG = YES)
 * Health care is the five industry groups the form offers under "Health
 * Care": Biotechnology, Pharmaceuticals, Health Insurance, Hospitals and
 * Physicians, Other Health Care. 2026 Q2 had 555 such filings (465 new
 * notices, 90 amendments). The 2024q3 file has the same columns; columns
 * are still found by header name.
 *
 * Amendments: a D/A restates an earlier notice, and TOTALAMOUNTSOLD is
 * cumulative for the offering, so counting both would double count. Each
 * D/A is followed back through PREVIOUSACCESSIONNUMBER to its original D.
 * An offering is counted once, in the quarter of its original notice,
 * with the amount sold from its latest filing in the window. Amendments to
 * notices filed before the window restate offerings from before it and
 * are left out (counted in `counts`, not in the totals).
 *
 * Window: the latest 8 quarterly files, two full years, the closest
 * match to the other Market Catalyst sources' 730 days. Summarized at
 * pull time; about 30MB of zips are read and a small JSON is kept.
 */
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { secFetch } from "./secHttp";

export const SOURCE_ID = "sec-edgar:form-d-health";
const DATASET_NAME = "sec-form-d-health";
const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");
const INDEX_URL = "https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets";
const SEC_ORIGIN = "https://www.sec.gov";
export const QUARTERS_IN_WINDOW = 8;
const TOP_OFFERINGS_KEPT = 50;

export const HEALTH_INDUSTRY_GROUPS = ["Biotechnology", "Pharmaceuticals", "Health Insurance", "Hospitals and Physicians", "Other Health Care"] as const;
const HEALTH_SET = new Set<string>(HEALTH_INDUSTRY_GROUPS);

export interface FormDOffering {
  accessionNumber: string; // the original notice
  entity: string;
  cik: string; // unpadded
  state: string; // STATEORCOUNTRYDESCRIPTION, e.g. "CALIFORNIA"
  industry: string;
  filingDate: string; // original notice, ISO
  quarter: string; // e.g. "2026Q2", of the original notice
  amountSold: number | null; // latest filing in the window; null when not a number
  offeringAmount: number | null; // null when "Indefinite"
  amendments: number;
  url: string;
}

export interface FormDSnapshot {
  dataset: string;
  pulledAt: string;
  quarters: string[];
  windowStart: string;
  windowEnd: string;
  sourceFiles: string[];
  counts: {
    /** Every health-care D and D/A in the window's files. */
    healthFilings: number;
    offerings: number;
    amendmentsFolded: number;
    amendmentsToEarlierOfferings: number;
  };
  /** One row per quarter and industry group: new offerings and dollars sold. */
  byQuarterIndustry: { quarter: string; industry: string; offerings: number; amountSold: number }[];
  byState: { state: string; offerings: number; amountSold: number }[];
  /** The largest offerings by amount sold, largest first. */
  topOfferings: FormDOffering[];
}

// ---------------------------------------------------------------------------
// Pure helpers (tested)
// ---------------------------------------------------------------------------

/** Quarter zips linked from the index page, newest first: { quarter: "2026Q2", url }. */
export function parseIndexLinks(html: string): { quarter: string; url: string }[] {
  const seen = new Map<string, string>();
  for (const m of html.matchAll(/href="([^"]*\/(\d{4})q([1-4])_d\.zip)"/gi)) {
    const quarter = `${m[2]}Q${m[3]}`;
    if (!seen.has(quarter)) seen.set(quarter, m[1].startsWith("http") ? m[1] : `${SEC_ORIGIN}${m[1]}`);
  }
  return Array.from(seen, ([quarter, url]) => ({ quarter, url })).sort((a, b) => b.quarter.localeCompare(a.quarter));
}

const MONTHS: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };

/** "30-JUN-2026" -> "2026-06-30"; null if unparseable. */
export function parseFilingDate(raw: string): string | null {
  const m = /^(\d{2})-([A-Z]{3})-(\d{4})$/.exec(raw.trim());
  return m && MONTHS[m[2]] ? `${m[3]}-${MONTHS[m[2]]}-${m[1]}` : null;
}

export function quarterBounds(quarter: string): { start: string; end: string } {
  const year = Number(quarter.slice(0, 4));
  const q = Number(quarter.slice(5));
  const start = `${year}-${String(q * 3 - 2).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, q * 3, 0)).toISOString().slice(0, 10);
  return { start, end };
}

/** Rows of a tab-separated file as objects keyed by header; rows with the wrong field count are skipped. */
export function parseTsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  const header = lines[0].replace(/^﻿/, "").split("\t").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = lines[i].split("\t");
    if (cells.length !== header.length) continue;
    const row: Record<string, string> = {};
    header.forEach((h, j) => (row[h] = cells[j].trim()));
    rows.push(row);
  }
  return rows;
}

const amount = (raw: string | undefined) => (raw && /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : null);

/** One health-care filing, joined across the three files. */
export interface FormDFiling {
  accessionNumber: string;
  type: "D" | "D/A";
  previousAccessionNumber: string;
  filingDate: string;
  quarter: string;
  industry: string;
  amountSold: number | null;
  offeringAmount: number | null;
  entity: string;
  cik: string;
  state: string;
}

/** The health-care, live filings in one quarter's three files. */
export function joinQuarter(
  quarter: string,
  submissions: Record<string, string>[],
  offerings: Record<string, string>[],
  issuers: Record<string, string>[]
): FormDFiling[] {
  const subBy = new Map(submissions.map((s) => [s.ACCESSIONNUMBER, s]));
  const issuerBy = new Map(issuers.filter((i) => i.IS_PRIMARYISSUER_FLAG === "YES").map((i) => [i.ACCESSIONNUMBER, i]));
  const out: FormDFiling[] = [];
  for (const o of offerings) {
    if (!HEALTH_SET.has(o.INDUSTRYGROUPTYPE)) continue;
    const s = subBy.get(o.ACCESSIONNUMBER);
    if (!s || s.TESTORLIVE !== "LIVE" || (s.SUBMISSIONTYPE !== "D" && s.SUBMISSIONTYPE !== "D/A")) continue;
    const filingDate = parseFilingDate(s.FILING_DATE);
    if (!filingDate) continue;
    const issuer = issuerBy.get(o.ACCESSIONNUMBER);
    out.push({
      accessionNumber: o.ACCESSIONNUMBER,
      type: s.SUBMISSIONTYPE,
      previousAccessionNumber: o.PREVIOUSACCESSIONNUMBER ?? "",
      filingDate,
      quarter,
      industry: o.INDUSTRYGROUPTYPE,
      amountSold: amount(o.TOTALAMOUNTSOLD),
      offeringAmount: amount(o.TOTALOFFERINGAMOUNT),
      entity: issuer?.ENTITYNAME ?? "",
      cik: issuer?.CIK ? String(Number(issuer.CIK)) : "",
      state: issuer?.STATEORCOUNTRYDESCRIPTION || issuer?.STATEORCOUNTRY || "",
    });
  }
  return out;
}

const filingIndexUrl = (cik: string, accession: string) =>
  cik ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, "")}/` : "https://www.sec.gov/search-filings";

/**
 * One offering per original D in the window, with amendments folded in
 * (see file header). Amendments whose chain doesn't reach a D in the
 * window are counted as restating earlier offerings.
 */
export function foldAmendments(filings: FormDFiling[]): { offerings: FormDOffering[]; amendmentsFolded: number; amendmentsToEarlierOfferings: number } {
  const originals = new Map(filings.filter((f) => f.type === "D").map((f) => [f.accessionNumber, f]));
  const amendments = new Map(filings.filter((f) => f.type === "D/A").map((f) => [f.accessionNumber, f]));
  const latestByRoot = new Map<string, FormDFiling>();
  const amendmentCount = new Map<string, number>();
  let amendmentsToEarlierOfferings = 0;
  for (const a of amendments.values()) {
    let cur = a.previousAccessionNumber;
    const visited = new Set<string>();
    while (cur && !originals.has(cur) && amendments.has(cur) && !visited.has(cur)) {
      visited.add(cur);
      cur = amendments.get(cur)!.previousAccessionNumber;
    }
    if (!cur || !originals.has(cur)) {
      amendmentsToEarlierOfferings++;
      continue;
    }
    amendmentCount.set(cur, (amendmentCount.get(cur) ?? 0) + 1);
    const prior = latestByRoot.get(cur);
    if (!prior || a.filingDate > prior.filingDate || (a.filingDate === prior.filingDate && a.accessionNumber > prior.accessionNumber)) latestByRoot.set(cur, a);
  }
  const offerings = Array.from(originals.values()).map((d): FormDOffering => {
    const latest = latestByRoot.get(d.accessionNumber) ?? d;
    return {
      accessionNumber: d.accessionNumber,
      entity: d.entity,
      cik: d.cik,
      state: d.state,
      industry: d.industry,
      filingDate: d.filingDate,
      quarter: d.quarter,
      amountSold: latest.amountSold,
      offeringAmount: latest.offeringAmount,
      amendments: amendmentCount.get(d.accessionNumber) ?? 0,
      url: filingIndexUrl(d.cik, d.accessionNumber),
    };
  });
  const amendmentsFolded = amendments.size - amendmentsToEarlierOfferings;
  return { offerings, amendmentsFolded, amendmentsToEarlierOfferings };
}

export function summarize(filings: FormDFiling[], meta: { pulledAt: string; quarters: string[]; sourceFiles: string[] }): FormDSnapshot {
  const { offerings, amendmentsFolded, amendmentsToEarlierOfferings } = foldAmendments(filings);
  const byQI = new Map<string, { quarter: string; industry: string; offerings: number; amountSold: number }>();
  const byState = new Map<string, { state: string; offerings: number; amountSold: number }>();
  for (const o of offerings) {
    const k = `${o.quarter}|${o.industry}`;
    const qi = byQI.get(k) ?? { quarter: o.quarter, industry: o.industry, offerings: 0, amountSold: 0 };
    qi.offerings++;
    qi.amountSold += o.amountSold ?? 0;
    byQI.set(k, qi);
    const stateKey = o.state || "Not reported";
    const st = byState.get(stateKey) ?? { state: stateKey, offerings: 0, amountSold: 0 };
    st.offerings++;
    st.amountSold += o.amountSold ?? 0;
    byState.set(stateKey, st);
  }
  const quarters = [...meta.quarters].sort();
  return {
    dataset: DATASET_NAME,
    pulledAt: meta.pulledAt,
    quarters,
    windowStart: quarterBounds(quarters[0]).start,
    windowEnd: quarterBounds(quarters[quarters.length - 1]).end,
    sourceFiles: meta.sourceFiles,
    counts: { healthFilings: filings.length, offerings: offerings.length, amendmentsFolded, amendmentsToEarlierOfferings },
    byQuarterIndustry: Array.from(byQI.values()).sort((a, b) => a.quarter.localeCompare(b.quarter) || a.industry.localeCompare(b.industry)),
    byState: Array.from(byState.values()).sort((a, b) => b.amountSold - a.amountSold || a.state.localeCompare(b.state)),
    topOfferings: offerings
      .filter((o) => (o.amountSold ?? 0) > 0)
      .sort((a, b) => (b.amountSold ?? 0) - (a.amountSold ?? 0) || a.accessionNumber.localeCompare(b.accessionNumber))
      .slice(0, TOP_OFFERINGS_KEPT),
  };
}

// ---------------------------------------------------------------------------
// Pull + snapshot
// ---------------------------------------------------------------------------

async function readQuarter(quarter: string, url: string): Promise<FormDFiling[]> {
  const res = await secFetch(url, "application/zip");
  if (!res.ok) throw new Error(`Form D data set ${quarter} returned ${res.status} (${url})`);
  const wanted = ["FORMDSUBMISSION.TSV", "OFFERING.TSV", "ISSUERS.TSV"];
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()), { filter: (f) => wanted.some((w) => f.name.toUpperCase().endsWith(w)) });
  const table = (suffix: string) => {
    const name = Object.keys(files).find((n) => n.toUpperCase().endsWith(suffix));
    if (!name) throw new Error(`Form D data set ${quarter} has no ${suffix} (${url})`);
    return parseTsv(Buffer.from(files[name]).toString("utf-8"));
  };
  return joinQuarter(quarter, table("FORMDSUBMISSION.TSV"), table("OFFERING.TSV"), table("ISSUERS.TSV"));
}

/** Live pull + snapshot to disk - run manually/on schedule, never from a page load (COST_AND_OPERATING_MODEL.md). */
export async function fetchAndSnapshot(log: (msg: string) => void = console.log): Promise<string> {
  const indexRes = await secFetch(INDEX_URL, "text/html");
  if (!indexRes.ok) throw new Error(`Form D data sets page returned ${indexRes.status} (${INDEX_URL})`);
  const links = parseIndexLinks(await indexRes.text()).slice(0, QUARTERS_IN_WINDOW);
  if (links.length < QUARTERS_IN_WINDOW) throw new Error(`Only ${links.length} quarterly zips linked from ${INDEX_URL} - page structure may have changed`);
  const filings: FormDFiling[] = [];
  for (const { quarter, url } of links) {
    const rows = await readQuarter(quarter, url);
    log(`[form-d] ${quarter}: ${rows.length} health-care filings`);
    filings.push(...rows);
  }
  const pulledAt = new Date().toISOString();
  const snapshot = summarize(filings, { pulledAt, quarters: links.map((l) => l.quarter), sourceFiles: links.map((l) => l.url) });
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const file = path.join(SNAPSHOTS_DIR, `${pulledAt.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 1));
  log(`[form-d] ${snapshot.counts.offerings} offerings, ${snapshot.counts.amendmentsFolded} amendments folded in, ${snapshot.counts.amendmentsToEarlierOfferings} amendments to earlier offerings left out`);
  return file;
}

export function latestSnapshotFile(): string | null {
  if (!fs.existsSync(SNAPSHOTS_DIR)) return null;
  const files = fs.readdirSync(SNAPSHOTS_DIR).filter((f) => f.endsWith(".json")).sort();
  return files.length ? path.join(SNAPSHOTS_DIR, files[files.length - 1]) : null;
}

/** Returns null (never throws) when no snapshot exists yet - callers must treat that as "no data available." */
export function loadLatestSnapshot(): FormDSnapshot | null {
  const file = latestSnapshotFile();
  return file ? (JSON.parse(fs.readFileSync(file, "utf-8")) as FormDSnapshot) : null;
}
