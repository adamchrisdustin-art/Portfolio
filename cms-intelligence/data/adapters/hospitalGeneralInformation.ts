/**
 * Reads the CMS "Hospital General Information" dataset that Track C v1's
 * pipeline (pipeline/pullCmsData.ts) already pulls live and commits to
 * data/cms/hospital-general-information/snapshots/. This is a deliberate,
 * documented exception to the general pipeline/cms-intelligence isolation
 * described in docs/cms-intelligence/PROJECT_BOUNDARY.md: the two systems
 * share no code (this file does not import anything from pipeline/), but
 * they do read the same already-public data file on disk for this one
 * dataset, so Phase 3's vertical-slice demo can use real, live-pulled
 * data instead of a fabricated fixture.
 *
 * Phase 4 (Data Source & Pipeline) is responsible for the ~15 remaining
 * CMS datasets and a formal adapter/source-registry pattern - this file
 * is intentionally minimal and specific to the one dataset that's already
 * live, not a preview of that pattern.
 */
import fs from "node:fs";
import path from "node:path";

const DATASET_NAME = "hospital-general-information";
const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "cms", DATASET_NAME, "snapshots");

export interface HospitalRow {
  facility_id: string;
  facility_name: string;
  state: string;
  hospital_type?: string;
  hospital_ownership?: string;
  emergency_services?: string;
  hospital_overall_rating?: string;
  [key: string]: unknown;
}

export interface HospitalSnapshot {
  dataset: string;
  datasetId: string;
  pulledAt: string;
  rowCount: number;
  rows: HospitalRow[];
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

export function loadSnapshot(file: string): HospitalSnapshot {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as HospitalSnapshot;
}

/** Returns null (never throws) when no snapshot exists yet - callers must
 * treat that as "no data available," the same honest-gap handling every
 * agent in this system uses rather than fabricating a result. */
export function loadLatestSnapshot(): HospitalSnapshot | null {
  const file = latestSnapshotFile();
  if (!file) return null;
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw) as HospitalSnapshot;
}

export const SOURCE_ID = "cms:hospital-general-information";
