/**
 * Autonomous monthly reasoning run (added 2026-09-25, per Adam): after the
 * monthly data pull, every agent re-runs with a real model doing salience
 * selection, then the executive analyst ranks and connects what matters
 * across all of them. The result is saved as a "reasoned run" and
 * auto-published to main (no human review - Adam's decision), which is
 * why every model-written sentence passes grounding.ts first.
 *
 * Cost gate: if no source's content changed since the last reasoned run,
 * nothing runs and nothing is spent (COST_AND_OPERATING_MODEL.md).
 */
import fs from "node:fs";
import path from "node:path";
import { runFullSweep, type FullSweepResult } from "../agents/orchestrator/fullSweep";
import type { ModelProvider } from "../providers/types";
import { runExecutiveAnalyst, type AnalystResult } from "./executiveAnalyst";
import { changedSources, currentFingerprints, toSourceIds, type Fingerprints } from "./sourceFingerprints";

export const REASONED_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", "reasoned");

export interface ReasonedRun {
  schemaVersion: 1;
  generatedAt: string;
  models: { salience: string | null; analyst: string | null };
  /** Fingerprints of the exact data this run reasoned over - the dashboard only shows the run while these still match. */
  sourceFingerprints: Fingerprints;
  changedDatasets: string[];
  sweep: FullSweepResult;
  analyst: AnalystResult;
}

export type MonthlyRunOutcome =
  | { status: "skipped-no-provider" }
  | { status: "skipped-unchanged" }
  | { status: "written"; file: string; run: ReasonedRun };

function reasonedFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
}

export function loadLatestReasonedRun(dir: string = REASONED_DIR): ReasonedRun | null {
  const files = reasonedFiles(dir);
  if (files.length === 0) return null;
  return JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), "utf-8")) as ReasonedRun;
}

function sameFingerprints(a: Fingerprints, b: Fingerprints): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => a[k] === b[k]);
}

/**
 * The latest reasoned run, but only if it describes exactly the data
 * currently committed. Once a newer pull lands and hasn't been reasoned
 * over yet, the dashboard falls back to the deterministic sweep rather
 * than showing last month's judgment next to this month's numbers.
 */
export function currentReasonedRun(dir: string = REASONED_DIR, fingerprints: Fingerprints = currentFingerprints()): ReasonedRun | null {
  const run = loadLatestReasonedRun(dir);
  return run && sameFingerprints(run.sourceFingerprints, fingerprints) ? run : null;
}

export async function runMonthlyReasoning(options: {
  salience: ModelProvider | null;
  analyst: ModelProvider | null;
  force?: boolean;
  outDir?: string;
  now?: Date;
}): Promise<MonthlyRunOutcome> {
  const { salience, analyst, force = false, outDir = REASONED_DIR, now = new Date() } = options;
  if (!analyst) return { status: "skipped-no-provider" };

  const fingerprints = currentFingerprints();
  const previous = loadLatestReasonedRun(outDir);
  const changed = changedSources(previous?.sourceFingerprints ?? null, fingerprints);
  if (previous && changed.length === 0 && !force) return { status: "skipped-unchanged" };

  const sweep = await runFullSweep({ modelProvider: salience });
  const analystResult = await runExecutiveAnalyst(sweep.allInsights, toSourceIds(changed), analyst);

  const run: ReasonedRun = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    models: { salience: salience?.name ?? null, analyst: analyst.name },
    sourceFingerprints: fingerprints,
    changedDatasets: changed,
    sweep,
    analyst: analystResult,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${now.toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`);
  fs.writeFileSync(file, JSON.stringify(run, null, 2));
  return { status: "written", file, run };
}
