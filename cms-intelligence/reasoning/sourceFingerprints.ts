/**
 * Content fingerprints of each source's latest snapshot - the change gate
 * for autonomous reasoning (COST_AND_OPERATING_MODEL.md: no new data, no
 * model call). The pull timestamp is stripped before hashing, so a
 * monthly re-pull of a source that hasn't actually published anything new
 * (e.g. an annual CMS file) fingerprints identically to last month.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const HEALTHCARE_INTELLIGENCE_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence");
/** Hospital General Information lives under data/cms/ (shared with pipeline/'s Track C v1 - see that adapter's header). */
const HOSPITAL_SNAPSHOTS_DIR = path.resolve(process.cwd(), "data", "cms", "hospital-general-information", "snapshots");

export type Fingerprints = Record<string, string>;

/** Snapshot folder name -> the SOURCE_ID its adapter stamps on every Insight (see each file in data/adapters/). */
export const SOURCE_ID_BY_DATASET: Record<string, string> = {
  "clinicaltrials-phase3-results": "clinicaltrials-gov:phase3-results",
  "fda-drug-approvals": "openfda:drugsfda-novel-approvals",
  "federal-register-documents": "federal-register:cms-documents",
  "home-health-care-agencies": "cms:home-health-care-agencies",
  "hospital-general-information": "cms:hospital-general-information",
  "ma-part-d-enrollment": "cms:ma-part-d-enrollment",
  "marketplace-rate-puf": "cms:marketplace-rate-puf",
  "medicare-physician-by-provider-summary": "cms:medicare-physician-by-provider",
  "medicare-physician-by-service-summary": "cms:medicare-physician-by-service",
  "nih-reporter-awards": "nih-reporter:project-awards",
  "sec-edgar-healthcare-filings": "sec-edgar:healthcare-8k-filings",
};

export function toSourceIds(datasets: string[]): string[] {
  return datasets.map((d) => SOURCE_ID_BY_DATASET[d]).filter((id): id is string => Boolean(id));
}

function snapshotDirs(): Record<string, string> {
  const dirs: Record<string, string> = {};
  if (fs.existsSync(HEALTHCARE_INTELLIGENCE_DIR)) {
    for (const name of fs.readdirSync(HEALTHCARE_INTELLIGENCE_DIR)) {
      const snapshots = path.join(HEALTHCARE_INTELLIGENCE_DIR, name, "snapshots");
      if (fs.existsSync(snapshots)) dirs[name] = snapshots;
    }
  }
  if (fs.existsSync(HOSPITAL_SNAPSHOTS_DIR)) dirs["hospital-general-information"] = HOSPITAL_SNAPSHOTS_DIR;
  return dirs;
}

export function fingerprintSnapshot(snapshot: Record<string, unknown>): string {
  const content = { ...snapshot };
  delete content.pulledAt;
  return crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export function currentFingerprints(): Fingerprints {
  const result: Fingerprints = {};
  for (const [source, dir] of Object.entries(snapshotDirs())) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    if (files.length === 0) continue;
    const latest = JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), "utf-8"));
    result[source] = fingerprintSnapshot(latest);
  }
  return result;
}

/** Sources that are new or whose latest content differs from `previous`. */
export function changedSources(previous: Fingerprints | null, current: Fingerprints): string[] {
  return Object.keys(current)
    .filter((source) => previous?.[source] !== current[source])
    .sort();
}
