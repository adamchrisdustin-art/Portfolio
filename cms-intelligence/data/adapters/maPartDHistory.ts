/**
 * Monthly history for CMS "Monthly Enrollment by Plan" (added 2026-09-25).
 * maPartDEnrollment.ts pulls only the latest month; this backfills every
 * month CMS still lists and summarizes each into small tables, so the MA
 * agent can report real month-over-month and year-over-year changes
 * instead of a single snapshot.
 *
 * Verified live 2026-09-25: the index page paginates (?page=N) and lists
 * 37 report periods, 2023-08 through 2026-09, each linking to a zip in the
 * same format the latest-month adapter already parses. Download and
 * parsing are shared with that adapter, so both read the file identically.
 *
 * Storage: one file per report period under months/ (a published month
 * doesn't change, so it's pulled once). The reasoning change gate keeps
 * fingerprinting the latest-month snapshot, which changes whenever CMS
 * publishes a new month.
 *
 * Segments: CMS's Organization Type separates Medicare Advantage (Local
 * and Regional CCP, PFFS, MSA) from standalone Part D drug plans (PDP,
 * including employer direct-contract PDPs). Cost plans, PACE and HCPP are
 * kept as "other". Summing MA and PDP together would mix two different
 * markets - a carrier can gain MA members while losing PDP members.
 */
import fs from "node:fs";
import path from "node:path";
import { downloadPlanRows, FETCH_HEADERS, INDEX_LINK_PATTERN, INDEX_URL, type MaPartDPlanRow } from "./maPartDEnrollment";

const MONTHS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", "ma-part-d-enrollment", "months");
const MAX_INDEX_PAGES = 20;

export type Segment = "ma" | "pdp" | "other";

const SEGMENT_BY_ORG_TYPE: Record<string, Segment> = {
  "Local CCP": "ma",
  "Regional CCP": "ma",
  PFFS: "ma",
  MSA: "ma",
  PDP: "pdp",
  "Employer/Union Only Direct Contract PDP": "pdp",
};

export function segmentOf(organizationType: string): Segment {
  return SEGMENT_BY_ORG_TYPE[organizationType] ?? "other";
}

export type SegmentTotals = Record<Segment, number>;

export interface MaMonthSummary {
  reportPeriod: string;
  sourceUrl: string;
  planRows: number;
  /** Rows CMS suppressed (enrollment of 10 or fewer), excluded rather than imputed. */
  suppressedRowCount: number;
  totals: SegmentTotals;
  byParentOrganization: ({ parentOrganization: string; plans: number } & SegmentTotals)[];
  byPlanType: ({ planType: string } & SegmentTotals)[];
  /** MA enrollees in plans that include Part D (MA-PD) vs. medical-only MA. */
  maWithPartD: number;
}

const zero = (): SegmentTotals => ({ ma: 0, pdp: 0, other: 0 });

/** Folds one month's plan rows into its summary tables. Exported for tests. */
export function summarizeMonth(rows: MaPartDPlanRow[], reportPeriod: string, sourceUrl: string, suppressedRowCount: number): MaMonthSummary {
  const totals = zero();
  const parents = new Map<string, { plans: number } & SegmentTotals>();
  const planTypes = new Map<string, SegmentTotals>();
  let maWithPartD = 0;

  for (const row of rows) {
    const segment = segmentOf(row.organizationType);
    totals[segment] += row.enrollment;
    if (segment === "ma" && row.offersPartD === "Yes") maWithPartD += row.enrollment;

    const parent = parents.get(row.parentOrganization) ?? { plans: 0, ...zero() };
    parent.plans++;
    parent[segment] += row.enrollment;
    parents.set(row.parentOrganization, parent);

    const type = planTypes.get(row.planType) ?? zero();
    type[segment] += row.enrollment;
    planTypes.set(row.planType, type);
  }

  return {
    reportPeriod,
    sourceUrl,
    planRows: rows.length,
    suppressedRowCount,
    totals,
    byParentOrganization: [...parents]
      .map(([parentOrganization, t]) => ({ parentOrganization, ...t }))
      .sort((a, b) => b.ma + b.pdp + b.other - (a.ma + a.pdp + a.other)),
    byPlanType: [...planTypes].map(([planType, t]) => ({ planType, ...t })).sort((a, b) => a.planType.localeCompare(b.planType)),
    maWithPartD,
  };
}

/** Every report period CMS lists, across the index's pages. */
export async function listReportPeriods(): Promise<{ period: string; pageUrl: string }[]> {
  const found = new Map<string, string>();
  for (let page = 0; page < MAX_INDEX_PAGES; page++) {
    const res = await fetch(`${INDEX_URL}?page=${page}`, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`CMS MA/Part D index page ${page} fetch failed: ${res.status} ${res.statusText}`);
    const before = found.size;
    for (const m of (await res.text()).matchAll(INDEX_LINK_PATTERN)) found.set(m[2], `https://www.cms.gov${m[1]}`);
    if (found.size === before) break;
  }
  return [...found].map(([period, pageUrl]) => ({ period, pageUrl })).sort((a, b) => a.period.localeCompare(b.period));
}

function monthFile(period: string): string {
  return path.join(MONTHS_DIR, `${period}.json`);
}

/** Pulls every listed month not yet on disk. Returns the periods written. */
export async function backfillMonths(log: (msg: string) => void = console.log): Promise<string[]> {
  const periods = await listReportPeriods();
  fs.mkdirSync(MONTHS_DIR, { recursive: true });
  const written: string[] = [];
  for (const { period, pageUrl } of periods) {
    if (fs.existsSync(monthFile(period))) continue;
    const { zipUrl, rows, suppressedRowCount } = await downloadPlanRows(pageUrl);
    const summary = summarizeMonth(rows, period, zipUrl, suppressedRowCount);
    fs.writeFileSync(monthFile(period), JSON.stringify(summary));
    log(`[ma-history] ${period}: MA ${summary.totals.ma.toLocaleString()}, PDP ${summary.totals.pdp.toLocaleString()} (${rows.length} plan rows)`);
    written.push(period);
  }
  return written;
}

/** Every summarized month on disk, oldest first. */
export function loadAllMonths(dir: string = MONTHS_DIR): MaMonthSummary[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as MaMonthSummary);
}
