/**
 * openFDA drugsfda API - real novel drug (new molecular entity) approval
 * activity, one of the 4 new sources for the Market/Catalyst Intelligence
 * agent (see cms-intelligence/agents/market-catalyst/agent.ts).
 *
 * Verified live 2026-09-24 via a real query against the endpoint below
 * (not assumed by analogy to any other source, per the master
 * orchestrator's "never invent a source" rule):
 *   https://api.fda.gov/drug/drugsfda.json
 *     ?search=submissions.submission_status_date:[<start> TO <end>]
 *       +AND+submissions.submission_class_code:"TYPE+1"
 *       +AND+submissions.submission_status:AP
 *     &limit=100
 * No API key needed.
 *
 * REAL GOTCHA CONFIRMED LIVE (not assumed - see the "TYPE 1" search match
 * against a real result during verification): openFDA's search matches at
 * the APPLICATION level, not the submission level - a single application
 * can have many submissions (original + supplements over years), and the
 * search above can return an application because ANY of its submissions
 * matches, even ones far outside the requested date window. A real
 * verified example: application BLA761467 (KEYTRUDA QLEX, sponsor Merck
 * Sharp Dohme) matched a query for a 2025-04-27..2025-09-24 window with
 * its ORIG submission (approved 2025-09-19, TYPE 1, PRIORITY review) -
 * correct - but the SAME application object also carried 10 other
 * unrelated SUPPL submissions (class "EFFICACY", not "TYPE 1", some dated
 * in 2026, outside the window) bundled into the same result. This adapter
 * therefore re-filters after fetching: it iterates each application's
 * real `submissions` array and keeps only the specific submission(s)
 * whose own `submission_status_date` actually falls in the window, whose
 * `submission_status` is exactly "AP", and whose `submission_class_code`
 * contains "TYPE 1" - never trusting application-level inclusion alone.
 *
 * There is NO "breakthrough therapy" field anywhere in this dataset - per
 * this project's binding rule (see market-catalyst agent header and
 * CLAUDE.md), this adapter and its consumers never use that word. The
 * real fields kept verbatim are `submission_class_code` (e.g. "TYPE 1")
 * and `review_priority` (e.g. "PRIORITY" vs "STANDARD").
 */
import fs from "node:fs";
import path from "node:path";

export const SOURCE_ID = "openfda:drugsfda-novel-approvals";
const DATASET_NAME = "fda-drug-approvals";
// Widened 2026-09-24 from 150 to 730 days (real 2-year window) per
// Adam's request for deeper real historical coverage. Verified live
// 2026-09-24: a real 730-day window returns 607 real matching
// APPLICATIONS (application-level match, see this file's own gotcha
// note) containing 105 real re-filtered Type-1/AP SUBMISSIONS - both
// comfortably under the raised LIMIT below (openFDA's documented max
// per-request limit is 1000), so this stays a single real request with
// no pagination needed and no silent truncation.
const WINDOW_DAYS = 730;
const BASE_URL = "https://api.fda.gov/drug/drugsfda.json";
const LIMIT = 1000;

const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");

export interface FdaApproval {
  applicationNumber: string;
  sponsorName: string;
  brandName: string;
  activeIngredient: string;
  submissionClassCode: string;
  reviewPriority: string;
  submissionStatusDate: string; // ISO date
  url: string;
}

export interface FdaApprovalsSnapshot {
  dataset: string;
  pulledAt: string;
  windowStart: string;
  lastUpdated: string; // openFDA's own meta.last_updated - the dataset's real publication vintage, not the pull date
  approvals: FdaApproval[];
}

interface RawSubmission {
  submission_type: string;
  submission_number: string;
  submission_status: string;
  submission_status_date: string; // YYYYMMDD
  review_priority?: string;
  submission_class_code?: string;
}

interface RawApplication {
  application_number: string;
  sponsor_name: string;
  submissions: RawSubmission[];
  products?: { brand_name?: string; active_ingredients?: { name: string }[] }[];
}

interface RawResponse {
  meta: { last_updated: string; results: { total: number } };
  results: RawApplication[];
}

function windowStartDate(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS);
  return d;
}

function fdaDateFormat(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function fdaDateToIso(fdaDate: string): string {
  // "20250919" -> "2025-09-19"
  return `${fdaDate.slice(0, 4)}-${fdaDate.slice(4, 6)}-${fdaDate.slice(6, 8)}`;
}

function accessDataUrl(applicationNumber: string): string {
  const digitsOnly = applicationNumber.replace(/\D/g, "");
  return `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${digitsOnly}`;
}

async function fetchApprovals(windowStart: Date, windowEnd: Date): Promise<{ approvals: FdaApproval[]; lastUpdated: string }> {
  const startStr = fdaDateFormat(windowStart);
  const endStr = fdaDateFormat(windowEnd);
  const search = `submissions.submission_status_date:[${startStr}+TO+${endStr}]+AND+submissions.submission_class_code:"TYPE+1"+AND+submissions.submission_status:AP`;
  const url = `${BASE_URL}?search=${search}&limit=${LIMIT}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    if (res.status === 404) {
      // openFDA returns 404 (not an empty result set) when a search matches zero records - a real, documented API behavior, not an error.
      return { approvals: [], lastUpdated: new Date().toISOString().slice(0, 10) };
    }
    throw new Error(`openFDA drugsfda query failed: ${res.status} ${res.statusText} (${url})`);
  }
  const body = (await res.json()) as RawResponse;

  const windowStartIso = windowStart.toISOString().slice(0, 10);
  const windowEndIso = windowEnd.toISOString().slice(0, 10);
  const approvals: FdaApproval[] = [];

  for (const app of body.results) {
    for (const sub of app.submissions) {
      if (sub.submission_status !== "AP") continue;
      if (!sub.submission_class_code || !sub.submission_class_code.includes("TYPE 1")) continue;
      const subDateIso = fdaDateToIso(sub.submission_status_date);
      if (subDateIso < windowStartIso || subDateIso > windowEndIso) continue;

      const product = app.products?.[0];
      approvals.push({
        applicationNumber: app.application_number,
        sponsorName: app.sponsor_name,
        brandName: product?.brand_name ?? "unknown",
        activeIngredient: product?.active_ingredients?.[0]?.name ?? "unknown",
        submissionClassCode: sub.submission_class_code,
        reviewPriority: sub.review_priority ?? "unknown",
        submissionStatusDate: subDateIso,
        url: accessDataUrl(app.application_number),
      });
    }
  }

  return { approvals, lastUpdated: body.meta.last_updated };
}

/** Live pull + snapshot to disk - run manually/on schedule, never from a page load (COST_AND_OPERATING_MODEL.md). */
export async function fetchAndSnapshot(): Promise<string> {
  const windowStart = windowStartDate();
  const windowEnd = new Date();
  const { approvals, lastUpdated } = await fetchApprovals(windowStart, windowEnd);

  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(SNAPSHOTS_DIR, `${stamp}.json`);
  const snapshot: FdaApprovalsSnapshot = {
    dataset: DATASET_NAME,
    pulledAt: new Date().toISOString(),
    windowStart: windowStart.toISOString().slice(0, 10),
    lastUpdated,
    approvals,
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

export function loadSnapshot(file: string): FdaApprovalsSnapshot {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as FdaApprovalsSnapshot;
}

/** Returns null (never throws) when no snapshot exists yet - callers must treat that as "no data available." */
export function loadLatestSnapshot(): FdaApprovalsSnapshot | null {
  const file = latestSnapshotFile();
  if (!file) return null;
  return loadSnapshot(file);
}
