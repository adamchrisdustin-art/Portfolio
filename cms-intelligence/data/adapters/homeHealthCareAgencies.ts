/**
 * CMS "Home Health Care Agencies" dataset - CMS Provider Data Catalog,
 * dataset id 6jpm-sxkc, same datastore API family as
 * hospitalGeneralInformation.ts (verified live 2026-09-23 via
 * https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items
 * and a real query against the datastore endpoint below - not a guessed
 * or fabricated ID, per the master orchestrator's "never invent a
 * source" rule).
 *
 * Unlike hospitalGeneralInformation.ts (which reads a snapshot Track C
 * v1's pipeline/ already pulls), this is this system's OWN first
 * adapter with its own live-pull path - the pattern Phase 4 formalizes
 * for every dataset added after this one. Snapshots land under
 * data/healthcare-intelligence/ (this system's own data root per
 * PROJECT_BOUNDARY.md), never data/cms/ (that's pipeline/'s).
 *
 * No API key required - public, unauthenticated dataset, same as
 * Hospital General Information.
 */
import fs from "node:fs";
import path from "node:path";

export const SOURCE_ID = "cms:home-health-care-agencies";
const DATASET_ID = "6jpm-sxkc";
const DATASET_NAME = "home-health-care-agencies";
const BASE_URL = `https://data.cms.gov/provider-data/api/1/datastore/query/${DATASET_ID}/0`;
const PAGE_SIZE = 500;

const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");

export interface HomeHealthAgencyRow {
  cms_certification_number_ccn: string;
  provider_name: string;
  state: string;
  citytown?: string;
  type_of_ownership?: string;
  certification_date?: string;
  quality_of_patient_care_star_rating?: string;
  // CMS truncates long field names with a hash suffix - this is the real
  // field name as returned by the live API (verified 2026-09-23), not a
  // typo. See the file header for how this was confirmed.
  how_much_medicare_spends_on_an_episode_of_care_at_this_agen_56e6?: string;
  no_of_episodes_to_calc_how_much_medicare_spends_per_episode_4f4e?: string;
  // Service-mix fields, added back 2026-09-23 (Phase 5 second addendum)
  // for a real state-by-state service-availability comparison - each is
  // a real "Yes"/"No" string from the live API, not a boolean CMS
  // returns natively.
  offers_nursing_care_services?: string;
  offers_physical_therapy_services?: string;
  offers_occupational_therapy_services?: string;
  offers_speech_pathology_services?: string;
  offers_medical_social_services?: string;
  offers_home_health_aide_services?: string;
  [key: string]: unknown;
}

export interface HomeHealthSnapshot {
  dataset: string;
  datasetId: string;
  pulledAt: string;
  rowCount: number;
  rows: HomeHealthAgencyRow[];
}

// The live API returns ~40 fields per row (most are quality-measure
// numerator/denominator pairs this system doesn't use). Persisting all
// of them for ~12,500 agencies produced a 77MB snapshot - real data,
// but impractical to commit to a public repo. Only the fields this
// system's agent actually reads are kept; everything else is dropped
// at pull time, not silently kept-but-ignored.
function slimRow(row: HomeHealthAgencyRow): HomeHealthAgencyRow {
  return {
    cms_certification_number_ccn: row.cms_certification_number_ccn,
    provider_name: row.provider_name,
    state: row.state,
    citytown: row.citytown,
    type_of_ownership: row.type_of_ownership,
    certification_date: row.certification_date,
    quality_of_patient_care_star_rating: row.quality_of_patient_care_star_rating,
    how_much_medicare_spends_on_an_episode_of_care_at_this_agen_56e6: row.how_much_medicare_spends_on_an_episode_of_care_at_this_agen_56e6,
    no_of_episodes_to_calc_how_much_medicare_spends_per_episode_4f4e: row.no_of_episodes_to_calc_how_much_medicare_spends_per_episode_4f4e,
    offers_nursing_care_services: row.offers_nursing_care_services,
    offers_physical_therapy_services: row.offers_physical_therapy_services,
    offers_occupational_therapy_services: row.offers_occupational_therapy_services,
    offers_speech_pathology_services: row.offers_speech_pathology_services,
    offers_medical_social_services: row.offers_medical_social_services,
    offers_home_health_aide_services: row.offers_home_health_aide_services,
  };
}

async function fetchAllRows(): Promise<HomeHealthAgencyRow[]> {
  const rows: HomeHealthAgencyRow[] = [];
  let offset = 0;

  for (;;) {
    const url = `${BASE_URL}?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`CMS datastore query failed: ${res.status} ${res.statusText} (${url})`);
    }
    const body = (await res.json()) as { results: HomeHealthAgencyRow[]; count: number };
    rows.push(...body.results.map(slimRow));

    offset += PAGE_SIZE;
    if (offset >= body.count || body.results.length === 0) break;
  }

  return rows;
}

/** Live pull + snapshot to disk - run manually/on schedule, never from a page load (COST_AND_OPERATING_MODEL.md). */
export async function fetchAndSnapshot(): Promise<string> {
  const rows = await fetchAllRows();
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(SNAPSHOTS_DIR, `${stamp}.json`);
  const snapshot: HomeHealthSnapshot = {
    dataset: DATASET_NAME,
    datasetId: DATASET_ID,
    pulledAt: new Date().toISOString(),
    rowCount: rows.length,
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

/**
 * A numeric cell as a number, or NaN when blank or "-" (not available).
 * CMS writes counts of 1,000 or more with thousands separators ("1,608"),
 * which plain Number() turns into NaN. Until 2026-09-25 that silently
 * dropped every agency with 1,000+ episodes - 73% of all episodes.
 */
export function parseNumericCell(raw: unknown): number {
  if (typeof raw !== "string" || raw.trim() === "") return NaN;
  return Number(raw.replace(/,/g, ""));
}

export function loadSnapshot(file: string): HomeHealthSnapshot {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as HomeHealthSnapshot;
}

export function loadLatestSnapshot(): HomeHealthSnapshot | null {
  const file = latestSnapshotFile();
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as HomeHealthSnapshot;
}
