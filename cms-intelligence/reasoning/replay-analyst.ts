/**
 * Prompt-tuning tool: re-runs only the executive-analyst step over the
 * latest committed reasoned run's real insights and prints the result next
 * to what was published. Writes nothing. One analyst call (~$0.05-0.10 on
 * the default Opus 5.5); needs that provider's API key in the environment.
 * Period comparisons and outliers are rebuilt from the committed snapshots, so they match
 * the run's data as long as no newer pull has landed since.
 *
 *   npx tsx cms-intelligence/reasoning/replay-analyst.ts
 */
import { createProviderFromSpec } from "../providers";
import { runExecutiveAnalyst } from "./executiveAnalyst";
import { loadLatestReasonedRun } from "./monthlyRun";
import { buildOutlierFacts } from "./outlierFacts";
import { buildPeriodFacts } from "./periodFacts";
import { applyRecency } from "../intelligence/evidence/recency";
import { toSourceIds, unchangedSinceBySource } from "./sourceFingerprints";

// Not imported from run-monthly-reasoning.ts: importing it runs its main(), a full billed monthly run.
const DEFAULT_ANALYST_MODEL = "anthropic:claude-opus-5-5";

async function main() {
  const run = loadLatestReasonedRun();
  if (!run) throw new Error("No committed reasoned run to replay.");
  const spec = process.env.ANALYST_MODEL || DEFAULT_ANALYST_MODEL;
  const provider = createProviderFromSpec(spec);
  if (!provider) throw new Error(`No API key for ${spec}.`);

  const replay = await runExecutiveAnalyst(applyRecency(run.sweep.allInsights, new Date(), unchangedSinceBySource()), toSourceIds(run.changedDatasets), provider, buildPeriodFacts(), buildOutlierFacts());
  console.log(JSON.stringify({ replayingRunFrom: run.generatedAt, published: run.analyst, replay }, null, 2));
}

main().catch((err) => {
  console.error("[replay-analyst] failed:", err);
  process.exitCode = 1;
});
