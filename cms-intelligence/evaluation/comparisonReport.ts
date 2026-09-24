/**
 * Turns one or more ProviderRunResult (from runner.ts) into a
 * human-readable markdown comparison - docs/cms-intelligence/
 * 06_PHASE_6_MODEL_PROVIDER_EVALUATION.md's required "comparison report"
 * output. Explicitly does not declare a universal winner (the phase
 * doc's own instruction) - it reports each provider's measured numbers
 * per category and leaves the routing call to router.ts's per-category
 * tiers, which should be revisited once this report reflects a real
 * (not mock) run.
 */
import { estimateCost } from "./costModel";
import type { ProviderRunResult } from "./types";

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export function buildComparisonReport(runs: ProviderRunResult[]): string {
  if (runs.length === 0) return "No provider runs to compare.";

  const lines: string[] = [];
  lines.push("# Model/Provider Evaluation - Comparison Report");
  lines.push("");
  lines.push(
    "Do not read this as declaring a universal winner - per docs/cms-intelligence/06_PHASE_6_MODEL_PROVIDER_EVALUATION.md, the objective is the best model/provider **for each class of workload**, based on measured evidence below."
  );
  lines.push("");
  lines.push("| Provider | Mean score | Schema compliance | Forbidden-claim rate | Refusal accuracy | Source citation | Mean latency (ms) | Est. cost/question |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const run of runs) {
    const cost = estimateCost(run.providerName);
    lines.push(
      `| ${run.providerName} | ${run.aggregate.meanScore.toFixed(2)} | ${pct(run.aggregate.schemaComplianceRate)} | ${pct(
        run.aggregate.forbiddenClaimRate
      )} | ${run.aggregate.refusalAccuracy === null ? "n/a" : pct(run.aggregate.refusalAccuracy)} | ${pct(
        run.aggregate.sourceCitationRate
      )} | ${run.aggregate.meanLatencyMs.toFixed(0)} | ${cost ? `$${cost.costPerQuestionUsd.toFixed(5)}` : "unpriced"} |`
    );
  }

  lines.push("");
  lines.push("## Per-task detail");
  for (const run of runs) {
    lines.push("");
    lines.push(`### ${run.providerName}`);
    for (const r of run.results) {
      lines.push(`- **${r.taskId}** (${r.category}) — score ${r.score.toFixed(2)}, ${r.latencyMs}ms${r.notes.length ? ` — ${r.notes.join(" ")}` : ""}`);
    }
  }

  return lines.join("\n");
}
