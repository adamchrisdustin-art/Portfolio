/**
 * Re-scores saved evaluation runs with the current scorer.ts, from each
 * run's stored raw model output - no API calls, no cost. Exists because
 * scoring is deterministic over saved answers, so a scorer fix (like the
 * 2026-09-25 negation/refusal fixes) shouldn't require re-buying the
 * answers. Rewrites each run's results.json and comparison report in
 * place; the pre-fix versions stay in git history.
 *
 *   npx tsx cms-intelligence/evaluation/rescore.ts
 */
import fs from "node:fs";
import path from "node:path";
import { BENCHMARK_SUITE } from "./benchmarkSuite";
import { buildComparisonReport } from "./comparisonReport";
import { aggregate } from "./runner";
import { scoreResponse } from "./scorer";
import type { ProviderRunResult } from "./types";

const RESULTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", "evaluation-runs");

export function rescoreRuns(runs: ProviderRunResult[]): ProviderRunResult[] {
  const taskById = new Map(BENCHMARK_SUITE.map((t) => [t.taskId, t]));
  return runs.map((run) => {
    const results = run.results.map((r) => {
      const task = taskById.get(r.taskId);
      return task ? scoreResponse(task, r.providerName, r.rawOutput, r.latencyMs) : r;
    });
    return { ...run, results, aggregate: aggregate(results) };
  });
}

function main() {
  for (const file of fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith("-results.json"))) {
    const resultsPath = path.join(RESULTS_DIR, file);
    const runs = rescoreRuns(JSON.parse(fs.readFileSync(resultsPath, "utf-8")) as ProviderRunResult[]);
    fs.writeFileSync(resultsPath, JSON.stringify(runs, null, 2));
    fs.writeFileSync(resultsPath.replace(/-results\.json$/, "-comparison-report.md"), buildComparisonReport(runs));
    console.log(`[rescore] ${file}: ${runs.map((r) => `${r.providerName} ${r.aggregate.meanScore.toFixed(2)}`).join(", ")}`);
  }
}

if (process.argv[1]?.endsWith("rescore.ts")) main();
