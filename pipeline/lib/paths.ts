import path from "node:path";
import fs from "node:fs";

// Everything lands under /data so it's inspectable in git history and the
// Streamlit/DuckDB layer can read it without a live DB connection.
export const DATA_ROOT = path.resolve(process.cwd(), "data", "cms");

export function datasetDir(dataset: string) {
  return path.join(DATA_ROOT, dataset);
}

export function snapshotsDir(dataset: string) {
  return path.join(datasetDir(dataset), "snapshots");
}

export function diffsDir(dataset: string) {
  return path.join(datasetDir(dataset), "diffs");
}

export function briefsDir(dataset: string) {
  return path.join(datasetDir(dataset), "briefs");
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Sorted ascending by filename (snapshots are named by ISO date). */
export function listSnapshots(dataset: string): string[] {
  const dir = snapshotsDir(dataset);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}
