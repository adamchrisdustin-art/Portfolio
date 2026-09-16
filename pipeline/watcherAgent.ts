/**
 * Watcher agent (Track C, ROADMAP.md step 2).
 *
 * Diffs the two most recent snapshots of a dataset and writes a compact
 * diff.json: facilities added, removed, or changed on the fields that
 * actually matter for a market-trend read (type, ownership, rating,
 * emergency services) - not a full-row diff, which would be noise (CMS
 * re-publishes the whole dataset each cycle even when nothing meaningful
 * changed for most rows).
 *
 * If there's only one snapshot so far (first run), writes an empty diff
 * rather than failing - the analyst agent treats that as "baseline
 * established, nothing to report yet."
 */
import fs from "node:fs";
import { diffsDir, ensureDir, listSnapshots, snapshotsDir } from "./lib/paths";

const DATASET_NAME = "hospital-general-information";
const TRACKED_FIELDS = [
  "hospital_type",
  "hospital_ownership",
  "emergency_services",
  "hospital_overall_rating",
] as const;

interface Row {
  facility_id: string;
  facility_name: string;
  state: string;
  [key: string]: unknown;
}

interface Snapshot {
  pulledAt: string;
  rowCount: number;
  rows: Row[];
}

function loadSnapshot(dataset: string, file: string): Snapshot {
  const raw = fs.readFileSync(`${snapshotsDir(dataset)}/${file}`, "utf-8");
  return JSON.parse(raw);
}

function main() {
  const files = listSnapshots(DATASET_NAME);
  const dir = diffsDir(DATASET_NAME);
  ensureDir(dir);
  const stamp = new Date().toISOString().slice(0, 10);
  const outFile = `${dir}/${stamp}.json`;

  if (files.length < 2) {
    console.log("[watch] fewer than 2 snapshots - writing empty baseline diff");
    fs.writeFileSync(
      outFile,
      JSON.stringify({ baseline: true, comparedAt: new Date().toISOString(), added: [], removed: [], changed: [] }, null, 2)
    );
    return;
  }

  const [prevFile, currFile] = files.slice(-2);
  const prev = loadSnapshot(DATASET_NAME, prevFile);
  const curr = loadSnapshot(DATASET_NAME, currFile);

  const prevById = new Map(prev.rows.map((r) => [r.facility_id, r]));
  const currById = new Map(curr.rows.map((r) => [r.facility_id, r]));

  const added: Row[] = [];
  const removed: Row[] = [];
  const changed: { facility_id: string; facility_name: string; state: string; field: string; from: unknown; to: unknown }[] = [];

  for (const [id, row] of currById) {
    if (!prevById.has(id)) {
      added.push(row);
      continue;
    }
    const prevRow = prevById.get(id)!;
    for (const field of TRACKED_FIELDS) {
      if (prevRow[field] !== row[field]) {
        changed.push({
          facility_id: id,
          facility_name: row.facility_name,
          state: row.state,
          field,
          from: prevRow[field],
          to: row[field],
        });
      }
    }
  }

  for (const [id, row] of prevById) {
    if (!currById.has(id)) removed.push(row);
  }

  const diff = {
    baseline: false,
    comparedAt: new Date().toISOString(),
    previousSnapshot: prevFile,
    currentSnapshot: currFile,
    added,
    removed,
    changed,
  };

  fs.writeFileSync(outFile, JSON.stringify(diff, null, 2));
  console.log(
    `[watch] ${added.length} added, ${removed.length} removed, ${changed.length} field changes -> ${outFile}`
  );
}

main();
