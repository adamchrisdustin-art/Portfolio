/**
 * Federal Register API - documents published by CMS (Centers for
 * Medicare & Medicaid Services), the first real data source for the
 * Policy, Regulation & CMS Program Intelligence agent (previously an
 * honest stub - see docs/cms-intelligence/MANIFEST.md's 2026-09-23
 * "Start here" entry naming this as the top data-source priority: "free,
 * no key, verified live").
 *
 * Verified live 2026-09-23 via a real query against the endpoint below
 * (not assumed by analogy to any other source, per the master
 * orchestrator's "never invent a source" rule):
 *   https://www.federalregister.gov/api/v1/documents.json
 *     ?conditions[agencies][]=centers-for-medicare-medicaid-services
 *     &conditions[publication_date][gte]=<date>
 *     &order=newest&per_page=250
 *     &fields[]=title&fields[]=type&fields[]=document_number
 *     &fields[]=html_url&fields[]=publication_date&fields[]=effective_on
 *     &fields[]=comments_close_on
 * Confirmed real fields: `type` is one of "Rule" | "Proposed Rule" |
 * "Notice" | "Presidential Document"; `effective_on` and
 * `comments_close_on` are nullable ISO dates, present on Rules and
 * Proposed Rules respectively. No API key, no auth, no rate-limit issue
 * observed for this volume.
 *
 * Scope: this project's own re-check cadence is quarterly (see
 * COST_AND_OPERATING_MODEL.md), so a single bounded request covering the
 * trailing WINDOW_DAYS (with real overlap margin for a delayed pull) is
 * pulled each time - not the full CMS history, which isn't needed and
 * isn't useful for a "what's currently in motion" read. CMS publishes
 * roughly 70-100 documents per 120-day window under this agency filter
 * (verified 2026-09-23), well under the single-request per_page cap used
 * here - if that ever changes, this file truncates rather than silently
 * paginating forever - bounded and documented.
 *
 * Widened 2026-09-24 from 120 to 730 days (real 2-year window) per
 * Adam's request for deeper real historical coverage. Verified live
 * 2026-09-24: a real 730-day window returns 487 real matching CMS
 * documents, and this API's real, documented per_page max of 1000
 * (raised below from 250) returns all 487 in a single real request -
 * confirmed via a live check, not full pagination, still a single
 * bounded request per pull.
 */
import fs from "node:fs";
import path from "node:path";

export const SOURCE_ID = "federal-register:cms-documents";
const AGENCY_SLUG = "centers-for-medicare-medicaid-services";
const BASE_URL = "https://www.federalregister.gov/api/v1/documents.json";
export const WINDOW_DAYS = 730;
const PER_PAGE = 1000;
const DATASET_NAME = "federal-register-documents";

const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");

export type FederalRegisterDocumentType = "Rule" | "Proposed Rule" | "Notice" | "Presidential Document" | string;

export interface FederalRegisterDocument {
  documentNumber: string;
  title: string;
  type: FederalRegisterDocumentType;
  publicationDate: string; // ISO date
  effectiveOn: string | null; // ISO date - set on some Rules
  commentsCloseOn: string | null; // ISO date - set on some Proposed Rules
  htmlUrl: string;
}

export interface FederalRegisterSnapshot {
  dataset: string;
  agencySlug: string;
  pulledAt: string;
  windowStart: string; // ISO date - the gte filter actually used for this pull
  rowCount: number;
  documents: FederalRegisterDocument[];
}

interface RawApiDocument {
  document_number: string;
  title: string;
  type: string;
  publication_date: string;
  effective_on: string | null;
  comments_close_on: string | null;
  html_url: string;
}

function windowStartDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
}

async function fetchDocuments(windowStart: string): Promise<FederalRegisterDocument[]> {
  const params = new URLSearchParams();
  params.append("conditions[agencies][]", AGENCY_SLUG);
  params.append("conditions[publication_date][gte]", windowStart);
  params.append("order", "newest");
  params.append("per_page", String(PER_PAGE));
  for (const f of ["title", "type", "document_number", "html_url", "publication_date", "effective_on", "comments_close_on"]) {
    params.append("fields[]", f);
  }

  const url = `${BASE_URL}?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Federal Register API query failed: ${res.status} ${res.statusText} (${url})`);
  }
  const body = (await res.json()) as { results: RawApiDocument[] };
  return body.results.map((d) => ({
    documentNumber: d.document_number,
    title: d.title,
    type: d.type,
    publicationDate: d.publication_date,
    effectiveOn: d.effective_on,
    commentsCloseOn: d.comments_close_on,
    htmlUrl: d.html_url,
  }));
}

/** Live pull + snapshot to disk - run manually/on schedule, never from a page load (COST_AND_OPERATING_MODEL.md). */
export async function fetchAndSnapshot(): Promise<string> {
  const windowStart = windowStartDate();
  const documents = await fetchDocuments(windowStart);

  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(SNAPSHOTS_DIR, `${stamp}.json`);
  const snapshot: FederalRegisterSnapshot = {
    dataset: DATASET_NAME,
    agencySlug: AGENCY_SLUG,
    pulledAt: new Date().toISOString(),
    windowStart,
    rowCount: documents.length,
    documents,
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

export function loadSnapshot(file: string): FederalRegisterSnapshot {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as FederalRegisterSnapshot;
}

/** Returns null (never throws) when no snapshot exists yet - callers must treat that as "no data available." */
export function loadLatestSnapshot(): FederalRegisterSnapshot | null {
  const file = latestSnapshotFile();
  if (!file) return null;
  return loadSnapshot(file);
}
