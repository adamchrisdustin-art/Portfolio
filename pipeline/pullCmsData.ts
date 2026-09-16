/**
 * Pull agent (Track C, ROADMAP.md step 1).
 *
 * Pulls the CMS Provider Data Catalog "Hospital General Information"
 * dataset (facility type, ownership, emergency services, overall rating -
 * the closest live, no-registration dataset to ROADMAP's "bed size and
 * provider counts by care setting" goal) and writes a dated JSON snapshot.
 *
 * Endpoint verified live during implementation:
 *   GET https://data.cms.gov/provider-data/api/1/datastore/query/{dataset-id}/0
 *   -> { results: [...], count, schema, query }
 * Dataset id xubh-q36u = "Hospital General Information", confirmed against
 * the live metastore (https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items).
 * This is the CMS Provider Data Catalog's own Datastore API, not the older
 * data.medicare.gov API and not HCRIS Cost Reports (those ship as flat
 * files, not a query API - a documented next step, not implemented here).
 *
 * No API key required - this is a public, unauthenticated dataset.
 */
import fs from "node:fs";
import { ensureDir, snapshotsDir } from "./lib/paths";

const DATASET_ID = "xubh-q36u";
const DATASET_NAME = "hospital-general-information";
const BASE_URL = `https://data.cms.gov/provider-data/api/1/datastore/query/${DATASET_ID}/0`;
const PAGE_SIZE = 500;

interface DatastoreResponse {
  results: Record<string, unknown>[];
  count: number;
}

async function fetchAllRows(): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  for (;;) {
    const url = `${BASE_URL}?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`CMS datastore query failed: ${res.status} ${res.statusText} (${url})`);
    }
    const body = (await res.json()) as DatastoreResponse;
    rows.push(...body.results);

    offset += PAGE_SIZE;
    if (offset >= body.count || body.results.length === 0) break;
  }

  return rows;
}

async function main() {
  console.log(`[pull] fetching ${DATASET_NAME} from CMS Provider Data Catalog...`);
  const rows = await fetchAllRows();
  console.log(`[pull] got ${rows.length} rows`);

  const dir = snapshotsDir(DATASET_NAME);
  ensureDir(dir);

  const stamp = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  const file = `${dir}/${stamp}.json`;

  // Idempotent: re-running the pipeline same-day overwrites rather than
  // creating duplicate snapshots the watcher would diff against itself.
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        dataset: DATASET_NAME,
        datasetId: DATASET_ID,
        pulledAt: new Date().toISOString(),
        rowCount: rows.length,
        rows,
      },
      null,
      2
    )
  );

  console.log(`[pull] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull] failed:", err);
  process.exitCode = 1;
});
