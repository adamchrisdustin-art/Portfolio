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
 * Sampling bound (same disclosed pattern as physicianOtherPractitioners.ts's
 * 5-state sample): keeps only the top 100 awards by award_amount (already
 * sorted server-side) out of a real ~49,000 total awards in a trailing
 * 150-day window as of 2026-09-24 - a real, disclosed bound, not the full
 * award population for the window.
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
const WINDOW_DAYS = 730;
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

/** Live pull + snapshot to disk - run manually/on schedule, never from a page load (COST_AND_OPERATING_MODEL.md). */
export async function fetchAndSnapshot(): Promise<string> {
  const windowStart = windowStartDate();
  const windowEnd = new Date().toISOString().slice(0, 10);
  const { awards, total } = await fetchAwards(windowStart, windowEnd);

  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(SNAPSHOTS_DIR, `${stamp}.json`);
  const snapshot: NihReporterSnapshot = {
    dataset: DATASET_NAME,
    pulledAt: new Date().toISOString(),
    windowStart,
    totalAvailable: total,
    awards,
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
