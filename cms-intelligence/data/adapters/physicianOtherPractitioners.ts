/**
 * CMS "Medicare Physician & Other Practitioners - by Provider and
 * Service" dataset - the first dataset named in the master
 * orchestrator's Phase 4 "Utilization / claims-derived" source list.
 * Verified live 2026-09-23 via data.cms.gov's search catalog and a real
 * query against the endpoint below (not the Provider Data Catalog API
 * family the other two adapters use - this is CMS's general Datastore
 * v1 API, data.cms.gov/data-api/v1/dataset/{id}/data, confirmed with
 * its own independent live check per the master orchestrator's "never
 * invent a source" rule).
 *
 * Real fields include Avg_Sbmtd_Chrg (submitted charge), Avg_Mdcr_Pymt_Amt
 * (actual Medicare payment), and Rndrng_Prvdr_Type (provider specialty) -
 * a direct, real "claims vs. payments by provider type" source.
 *
 * Scope: the full national file is organized by NPI x HCPCS x place of
 * service - tens of millions of rows for a single year, not a sane pull
 * for a portfolio project. This adapter pulls a bounded, explicitly
 * documented sample: every row for a fixed set of representative states
 * (WA, CA, TX, NY, FL), using the API's real `filter[field]=value`
 * support (verified live) rather than pulling everything and discarding
 * most of it. `sampledStates` is recorded on the snapshot itself so
 * nothing downstream can mistake this for the full national picture.
 */
import fs from "node:fs";
import path from "node:path";

export const SOURCE_ID = "cms:medicare-physician-other-practitioners";
const DATASET_ID = "92396110-2aed-4d63-a6a2-5d6207d46a29"; // 2024 data, published 2026-05-21
const BASE_URL = `https://data.cms.gov/data-api/v1/dataset/${DATASET_ID}/data`;
const ROWS_PER_STATE = 1000; // bounded sample per state - a full multi-page pull made a 112MB snapshot, impractical to commit
const SAMPLED_STATES = ["WA", "CA", "TX", "NY", "FL"];
const DATASET_NAME = "medicare-physician-other-practitioners";

const SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", DATASET_NAME, "snapshots");

export interface PhysicianServiceRow {
  Rndrng_NPI: string;
  Rndrng_Prvdr_Last_Org_Name?: string;
  Rndrng_Prvdr_Type: string;
  Rndrng_Prvdr_State_Abrvtn: string;
  HCPCS_Cd: string;
  HCPCS_Desc?: string;
  Place_Of_Srvc?: string;
  Avg_Sbmtd_Chrg: string;
  Avg_Mdcr_Alowd_Amt: string;
  Avg_Mdcr_Pymt_Amt: string;
  Tot_Benes?: string;
  Tot_Srvcs?: string;
  [key: string]: unknown;
}

export interface PhysicianServiceSnapshot {
  dataset: string;
  datasetId: string;
  pulledAt: string;
  sampledStates: string[];
  rowCount: number;
  rows: PhysicianServiceRow[];
}

async function fetchStateRows(state: string): Promise<PhysicianServiceRow[]> {
  // A single bounded request per state, well under the API's own
  // PAGE_SIZE ceiling - see ROWS_PER_STATE's comment for why (a full
  // multi-page pull produced a 112MB snapshot, impractical to commit to
  // a public repo for a portfolio demo).
  const url = `${BASE_URL}?filter[Rndrng_Prvdr_State_Abrvtn]=${state}&size=${ROWS_PER_STATE}&offset=0`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`CMS data-api query failed for ${state}: ${res.status} ${res.statusText} (${url})`);
  }
  return (await res.json()) as PhysicianServiceRow[];
}

export async function fetchAndSnapshot(): Promise<string> {
  const allRows: PhysicianServiceRow[] = [];
  for (const state of SAMPLED_STATES) {
    const rows = await fetchStateRows(state);
    allRows.push(...rows);
  }

  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(SNAPSHOTS_DIR, `${stamp}.json`);
  const snapshot: PhysicianServiceSnapshot = {
    dataset: DATASET_NAME,
    datasetId: DATASET_ID,
    pulledAt: new Date().toISOString(),
    sampledStates: SAMPLED_STATES,
    rowCount: allRows.length,
    rows: allRows,
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

export function loadSnapshot(file: string): PhysicianServiceSnapshot {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as PhysicianServiceSnapshot;
}

export function loadLatestSnapshot(): PhysicianServiceSnapshot | null {
  const file = latestSnapshotFile();
  if (!file) return null;
  return loadSnapshot(file);
}
