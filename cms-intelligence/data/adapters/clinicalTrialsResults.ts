/**
 * ClinicalTrials.gov v2 API - real Phase 3 trials with results newly
 * posted, one of the 4 new sources for the Market/Catalyst Intelligence
 * agent (see cms-intelligence/agents/market-catalyst/agent.ts).
 *
 * Verified live 2026-09-24 via a real query against the endpoint below
 * (not assumed by analogy to any other source, per the master
 * orchestrator's "never invent a source" rule):
 *   GET https://clinicaltrials.gov/api/v2/studies
 *     ?filter.advanced=AREA[Phase]PHASE3
 *     &query.term=AREA[ResultsFirstPostDate]RANGE[<start>,<end>]
 *     &fields=NCTId,BriefTitle,LeadSponsorName,LeadSponsorClass,
 *             ResultsFirstPostDate,EnrollmentCount
 *     &pageSize=100
 * No API key needed. The requested field names above ARE the correct,
 * case-sensitive v2 field names (confirmed live - the query returns real
 * data, not a 400), but the RESPONSE shape is not flat - each field
 * requested comes back nested under its real module inside
 * `studies[].protocolSection`, not as a flat top-level key:
 *   protocolSection.identificationModule.{nctId, briefTitle}
 *   protocolSection.statusModule.resultsFirstPostDateStruct.date
 *   protocolSection.sponsorCollaboratorsModule.leadSponsor.{name, class}
 *   protocolSection.designModule.enrollmentInfo.count
 * This adapter parses that real nested shape, not a flat one.
 *
 * Only `leadSponsor.class === "INDUSTRY"` trials are kept - a deliberate
 * adapter-level filter (not agent-level) since "industry-sponsored" is a
 * structural property of the source data itself, same reasoning as
 * marketplaceRatePuf.ts's plausible-rate filtering happening at the
 * adapter boundary. This is the most executive-relevant subset (the
 * commercial-catalyst signal an executive dashboard cares about), not
 * academic/NIH/other-government-sponsored trials.
 *
 * Per this project's binding honesty rule (see market-catalyst agent
 * header and CLAUDE.md): a results posting on ClinicalTrials.gov encodes
 * NO success/failure judgment - this adapter and its consumers never say
 * "positive result," only that results were posted, by whom, with what
 * real enrollment number.
 *
 * Widened 2026-09-24 from 150 to 730 days (real 2-year window) per
 * Adam's request for deeper real historical coverage. Verified live
 * 2026-09-24: a real 730-day window matches 1,706 real Phase 3 studies
 * (before the industry-sponsor filter, and before pageSize=100 would
 * have silently truncated it) - real pagination was added below (the
 * documented real `nextPageToken` field, requested max pageSize=1000 per
 * page) rather than raising a single request's cap, since this
 * population is too large for one request. Bounded to a real, disclosed
 * MAX_PAGES safety cap so a future, even-larger window degrades to an
 * honest undercount rather than an unbounded loop.
 */
import fs from "node:fs";
import path from "node:path";

export const SOURCE_ID = "clinicaltrials-gov:phase3-results";
const DATASET_NAME = "clinicaltrials-phase3-results";
const WINDOW_DAYS = 730;
const BASE_URL = "https://clinicaltrials.gov/api/v2/studies";
const PAGE_SIZE = 1000; // ClinicalTrials.gov v2's documented real max page size
const MAX_PAGES = 10; // real, disclosed safety cap - up to 10,000 raw studies per pull before this adapter would undercount

const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");

export interface ClinicalTrialResult {
  nctId: string;
  briefTitle: string;
  leadSponsorName: string;
  leadSponsorClass: string;
  resultsFirstPostDate: string; // ISO date
  enrollmentCount: number;
  url: string;
}

export interface ClinicalTrialsSnapshot {
  dataset: string;
  pulledAt: string;
  windowStart: string;
  trials: ClinicalTrialResult[];
}

interface RawStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: { resultsFirstPostDateStruct?: { date?: string } };
    sponsorCollaboratorsModule?: { leadSponsor?: { name?: string; class?: string } };
    designModule?: { enrollmentInfo?: { count?: number } };
  };
}

interface RawResponse {
  studies: RawStudy[];
  nextPageToken?: string;
}

function windowStartDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
}

function studyUrl(nctId: string): string {
  return `https://clinicaltrials.gov/study/${nctId}`;
}

function parseStudy(study: RawStudy): ClinicalTrialResult | null {
  const p = study.protocolSection;
  const nctId = p?.identificationModule?.nctId;
  const leadSponsorClass = p?.sponsorCollaboratorsModule?.leadSponsor?.class;
  if (!nctId || leadSponsorClass !== "INDUSTRY") return null; // adapter-level industry-only filter, see this file's header
  return {
    nctId,
    briefTitle: p?.identificationModule?.briefTitle ?? "unknown",
    leadSponsorName: p?.sponsorCollaboratorsModule?.leadSponsor?.name ?? "unknown",
    leadSponsorClass,
    resultsFirstPostDate: p?.statusModule?.resultsFirstPostDateStruct?.date ?? "",
    enrollmentCount: p?.designModule?.enrollmentInfo?.count ?? 0,
    url: studyUrl(nctId),
  };
}

/** Real pagination via ClinicalTrials.gov v2's documented `nextPageToken` field - see this file's header for why a single request isn't enough over a 2-year window. */
async function fetchTrials(windowStart: string, windowEnd: string): Promise<ClinicalTrialResult[]> {
  const fields = "NCTId,BriefTitle,LeadSponsorName,LeadSponsorClass,ResultsFirstPostDate,EnrollmentCount";
  const filterAdvanced = "AREA[Phase]PHASE3";
  const queryTerm = `AREA[ResultsFirstPostDate]RANGE[${windowStart},${windowEnd}]`;

  const trials: ClinicalTrialResult[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${BASE_URL}?filter.advanced=${encodeURIComponent(filterAdvanced)}&query.term=${encodeURIComponent(queryTerm)}&fields=${encodeURIComponent(fields)}&pageSize=${PAGE_SIZE}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`ClinicalTrials.gov v2 studies query failed: ${res.status} ${res.statusText} (${url})`);
    }
    const body = (await res.json()) as RawResponse;
    for (const study of body.studies) {
      const parsed = parseStudy(study);
      if (parsed) trials.push(parsed);
    }
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return trials;
}

/** Live pull + snapshot to disk - run manually/on schedule, never from a page load (COST_AND_OPERATING_MODEL.md). */
export async function fetchAndSnapshot(): Promise<string> {
  const windowStart = windowStartDate();
  const windowEnd = new Date().toISOString().slice(0, 10);
  const trials = await fetchTrials(windowStart, windowEnd);

  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(SNAPSHOTS_DIR, `${stamp}.json`);
  const snapshot: ClinicalTrialsSnapshot = {
    dataset: DATASET_NAME,
    pulledAt: new Date().toISOString(),
    windowStart,
    trials,
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

export function loadSnapshot(file: string): ClinicalTrialsSnapshot {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as ClinicalTrialsSnapshot;
}

/** Returns null (never throws) when no snapshot exists yet - callers must treat that as "no data available." */
export function loadLatestSnapshot(): ClinicalTrialsSnapshot | null {
  const file = latestSnapshotFile();
  if (!file) return null;
  return loadSnapshot(file);
}
