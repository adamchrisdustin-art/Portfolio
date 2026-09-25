/**
 * NIH RePORTER "projects/search" API - real NIH grant award-notice
 * activity, one of the 4 new sources for the Market/Catalyst Intelligence
 * agent (see cms-intelligence/agents/market-catalyst/agent.ts).
 *
 * Verified live 2026-09-24 via a real query against the endpoint below
 * (not assumed by analogy to any other source, per the master
 * orchestrator's "never invent a source" rule):
 *   POST https://api.reporter.nih.gov/v2/projects/search
 *   { criteria: { award_notice_date: { from_date, to_date } },
 *     include_fields: [...], sort_field: "award_amount",
 *     sort_order: "desc", limit: 100 }
 * No API key needed.
 *
 * REAL GOTCHA CONFIRMED LIVE (not assumed): the `include_fields` values
 * documented/commonly cited elsewhere as PascalCase (e.g. "ProjectNum",
 * "AwardAmount") do NOT control the response field casing - the real
 * response always comes back in the API's own snake_case shape
 * regardless of what's passed in `include_fields`:
 *   project_num, project_title, agency_code, activity_code, award_amount,
 *   award_notice_date (an ISO datetime, e.g. "2025-09-13T00:00:00"), and
 *   a nested `organization.org_name` (not a flat "Organization" string).
 * This adapter parses the real snake_case/nested shape, not the
 * PascalCase field names the request itself names.
 *
 * A real "AppId"/`appl_id` field was tried during verification and is NOT
 * present in the response even when requested - so the permalink below
 * uses the documented `project_num`-based search URL shape per this
 * adapter's spec, not an application-ID-based one.
 *
 * `terms` field (added 2026-09-24, per Adam's request for research-theme
 * signal from this data): verified live as a real, always-populated
 * string field, e.g. "<Diabetes Mellitus><Gene Expression><Mice>..." - a
 * project's own MeSH-like keyword tags, angle-bracket-delimited, NOT a
 * clean single "category" (a real `spending_categories_desc` field was
 * also tried live and returns `null` for every real result - not a
 * usable field, so not used here). Parsed into a string array by this
 * adapter; a downstream agent may count real term frequency across the
 * sample for a themes/trends read, but must never treat one term as an
 * official NIH-assigned research category - it's a real, granular
 * keyword tag, and generic/common biomedical terms will legitimately
 * recur often regardless of genuine thematic concentration.
 *
 * Two layers: the `awards` list keeps the top 100 awards by award_amount
 * (sorted server-side) with full detail, and since 2026-09-25 `summary`
 * covers every award in the window (see NihAwardSummary below). Totals and
 * breakdowns come from the summary; the top-100 list is for naming
 * specific awards and recipients.
 */
import fs from "node:fs";
import path from "node:path";

export const SOURCE_ID = "nih-reporter:project-awards";
const DATASET_NAME = "nih-reporter-awards";
// Widened 2026-09-24 from 150 to 730 days (real 2-year window) per Adam's
// request for deeper real historical coverage - this source's top-100-
// by-dollar sampling is already a deliberate, disclosed bound (see this
// file's own header), so widening the window just draws that same real
// sample from a larger real population, no truncation risk introduced.
export const WINDOW_DAYS = 730;
const BASE_URL = "https://api.reporter.nih.gov/v2/projects/search";
const LIMIT = 100;

const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");

export interface NihAward {
  projectNum: string;
  projectTitle: string;
  organization: string;
  awardAmount: number;
  awardNoticeDate: string; // ISO date
  agencyCode: string;
  activityCode: string;
  url: string;
  /** Real per-project MeSH-like keyword tags, already split out of the raw "<Term1><Term2>..." string - see this file's header. */
  terms: string[];
}

export interface NihReporterSnapshot {
  dataset: string;
  pulledAt: string;
  windowStart: string;
  totalAvailable: number; // the API's real reported total in this window - always larger than the 100-row sample kept, see this file's header
  awards: NihAward[];
  /** Every award notice in the window, summarized. Absent on snapshots from before 2026-09-25. */
  summary?: NihAwardSummary;
}

export interface NihTotals {
  notices: number;
  dollars: number;
}

/**
 * Full-population summary tables (added 2026-09-25): every award notice in
 * the window, not just the top 100, so agents can analyze funding by
 * month, institute, state and award type. Built by paging the whole window
 * one calendar month at a time - verified live 2026-09-25: the API returns
 * at most 500 records per request and rejects offsets of 15,000 or more,
 * so a range that exceeds that is split in half until it fits. Paging is
 * sorted by the unique `appl_id` (returned when requested as "ApplId"),
 * which keeps pages stable and lets duplicates be dropped exactly.
 */
export interface NihAwardSummary extends NihTotals {
  /** Awards the API reported for the window, to confirm nothing was missed. */
  reportedTotal: number;
  /** Awards with no award_amount, counted in notices but adding $0. */
  missingAmount: number;
  byMonth: ({ month: string } & NihTotals)[];
  /** Administering institute (NCI, NIAID...), from agency_ic_admin. */
  byMonthInstitute: ({ month: string; institute: string } & NihTotals)[];
  byState: ({ state: string } & NihTotals)[];
  byActivityCode: ({ activityCode: string } & NihTotals)[];
  byFundingMechanism: ({ mechanism: string } & NihTotals)[];
}

interface RawResult {
  project_num: string;
  project_title: string;
  organization?: { org_name?: string };
  award_amount: number;
  award_notice_date: string; // ISO datetime
  agency_code: string;
  activity_code: string;
  terms?: string | null;
}

/** Splits the real "<Term1><Term2><Term3>" raw string into a clean array - real gotcha: NIH RePORTER returns this null for some projects, not always populated. */
function parseTerms(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[<>]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

interface RawResponse {
  meta: { total: number };
  results: RawResult[];
}

function windowStartDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
}

function projectUrl(projectNum: string): string {
  return `https://reporter.nih.gov/search/${encodeURIComponent(projectNum)}/projects`;
}

async function fetchAwards(windowStart: string, windowEnd: string): Promise<{ awards: NihAward[]; total: number }> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      criteria: { award_notice_date: { from_date: windowStart, to_date: windowEnd } },
      include_fields: ["ProjectNum", "ProjectTitle", "Organization", "AwardAmount", "AwardNoticeDate", "AgencyCode", "ActivityCode", "Terms"],
      sort_field: "award_amount",
      sort_order: "desc",
      limit: LIMIT,
    }),
  });
  if (!res.ok) {
    throw new Error(`NIH RePORTER projects/search query failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as RawResponse;
  const awards = body.results.map((r) => ({
    projectNum: r.project_num,
    projectTitle: r.project_title,
    organization: r.organization?.org_name ?? "unknown",
    awardAmount: r.award_amount,
    awardNoticeDate: r.award_notice_date.slice(0, 10),
    agencyCode: r.agency_code,
    activityCode: r.activity_code,
    url: projectUrl(r.project_num),
    terms: parseTerms(r.terms),
  }));
  return { awards, total: body.meta.total };
}

const SUMMARY_PAGE_SIZE = 500; // the API's real per-request maximum
const MAX_OFFSET = 14_999; // the API rejects offsets of 15,000 or more
const REQUEST_GAP_MS = 1_100; // NIH asks for no more than 1 request per second

export interface SummaryRecord {
  appl_id: number;
  award_amount: number | null;
  award_notice_date: string;
  activity_code?: string | null;
  funding_mechanism?: string | null;
  organization?: { org_state?: string | null } | null;
  agency_ic_admin?: { abbreviation?: string | null } | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function searchPage(from: string, to: string, offset: number, attempt = 1): Promise<{ total: number; results: SummaryRecord[] }> {
  await sleep(REQUEST_GAP_MS);
  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        criteria: { award_notice_date: { from_date: from, to_date: to } },
        include_fields: ["ApplId", "AwardAmount", "AwardNoticeDate", "ActivityCode", "FundingMechanism", "Organization", "AgencyIcAdmin"],
        sort_field: "appl_id",
        sort_order: "asc",
        limit: SUMMARY_PAGE_SIZE,
        offset,
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const body = (await res.json()) as { meta: { total: number }; results: SummaryRecord[] };
    return { total: body.meta.total, results: body.results };
  } catch (err) {
    if (attempt >= 4) throw new Error(`NIH RePORTER summary page failed after ${attempt} attempts (${from}..${to} offset ${offset}): ${err}`);
    await sleep(3000 * attempt);
    return searchPage(from, to, offset, attempt + 1);
  }
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Every record in [from, to], halving the range whenever it holds more than one query can page through. */
async function fetchRange(from: string, to: string, into: Map<number, SummaryRecord>): Promise<number> {
  const first = await searchPage(from, to, 0);
  if (first.total > MAX_OFFSET + 1 && from !== to) {
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
    const mid = addDays(from, Math.floor(days / 2));
    return (await fetchRange(from, mid, into)) + (await fetchRange(addDays(mid, 1), to, into));
  }
  for (const r of first.results) into.set(r.appl_id, r);
  for (let offset = SUMMARY_PAGE_SIZE; offset < first.total && offset <= MAX_OFFSET; offset += SUMMARY_PAGE_SIZE) {
    for (const r of (await searchPage(from, to, offset)).results) into.set(r.appl_id, r);
  }
  return first.total;
}

function tally<K extends string>(records: SummaryRecord[], keyOf: (r: SummaryRecord) => string, name: K): ({ [P in K]: string } & NihTotals)[] {
  const groups = new Map<string, NihTotals>();
  for (const r of records) {
    const key = keyOf(r);
    const g = groups.get(key) ?? { notices: 0, dollars: 0 };
    g.notices++;
    g.dollars += r.award_amount ?? 0;
    groups.set(key, g);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, totals]) => ({ [name]: key, ...totals }) as { [P in K]: string } & NihTotals);
}

/** Folds every award record into the summary tables. Exported for tests. */
export function summarizeNihRecords(records: SummaryRecord[], reportedTotal: number): NihAwardSummary {
  const month = (r: SummaryRecord) => r.award_notice_date.slice(0, 7);
  const institute = (r: SummaryRecord) => r.agency_ic_admin?.abbreviation || "unknown";
  return {
    notices: records.length,
    dollars: records.reduce((s, r) => s + (r.award_amount ?? 0), 0),
    reportedTotal,
    missingAmount: records.filter((r) => r.award_amount == null).length,
    byMonth: tally(records, month, "month"),
    byMonthInstitute: tally(records, (r) => `${month(r)}\u0000${institute(r)}`, "key").map(({ key, ...totals }) => ({
      month: key.split("\u0000")[0],
      institute: key.split("\u0000")[1],
      ...totals,
    })),
    byState: tally(records, (r) => r.organization?.org_state || "unknown", "state"),
    byActivityCode: tally(records, (r) => r.activity_code || "unknown", "activityCode"),
    byFundingMechanism: tally(records, (r) => r.funding_mechanism || "unknown", "mechanism"),
  };
}

/** Pages the whole window one calendar month at a time (about 290 requests for 2 years, ~6 minutes at NIH's 1 request/second). */
export async function fetchSummary(windowStart: string, windowEnd: string): Promise<NihAwardSummary> {
  const records = new Map<number, SummaryRecord>();
  let reportedTotal = 0;
  for (let from = windowStart; from <= windowEnd; ) {
    const monthEnd = addDays(`${addDays(`${from.slice(0, 7)}-01`, 32).slice(0, 7)}-01`, -1);
    const to = monthEnd < windowEnd ? monthEnd : windowEnd;
    reportedTotal += await fetchRange(from, to, records);
    from = addDays(to, 1);
  }
  return summarizeNihRecords([...records.values()], reportedTotal);
}

/** Live pull + snapshot to disk - run manually/on schedule, never from a page load (COST_AND_OPERATING_MODEL.md). */
export async function fetchAndSnapshot(): Promise<string> {
  const windowStart = windowStartDate();
  const windowEnd = new Date().toISOString().slice(0, 10);
  const { awards, total } = await fetchAwards(windowStart, windowEnd);
  const summary = await fetchSummary(windowStart, windowEnd);

  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(SNAPSHOTS_DIR, `${stamp}.json`);
  const snapshot: NihReporterSnapshot = {
    dataset: DATASET_NAME,
    pulledAt: new Date().toISOString(),
    windowStart,
    totalAvailable: total,
    awards,
    summary,
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

export function loadSnapshot(file: string): NihReporterSnapshot {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as NihReporterSnapshot;
}

/** Returns null (never throws) when no snapshot exists yet - callers must treat that as "no data available." */
export function loadLatestSnapshot(): NihReporterSnapshot | null {
  const file = latestSnapshotFile();
  if (!file) return null;
  return loadSnapshot(file);
}
