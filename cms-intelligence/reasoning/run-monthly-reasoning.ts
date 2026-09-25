/**
 * Entry point for the monthly GitHub Actions workflow
 * (.github/workflows/healthcare-intelligence-pipeline.yml), run right
 * after the data pull. Keys come from GitHub Actions secrets, never from
 * the repo. Makes real, billed API calls only when some source's content
 * actually changed - otherwise exits having spent nothing.
 *
 * Which model does which job is config, not code:
 *   SALIENCE_MODEL - narrow per-agent picks, "provider:model"
 *   ANALYST_MODEL  - cross-agent executive reasoning, "provider:model"
 *   FORCE_REASONING=1 re-runs even when no data changed.
 */
import { createProviderFromSpec } from "../providers";
import { runMonthlyReasoning } from "./monthlyRun";

/**
 * Chosen from the 2026-09-25 six-model live benchmark (MODEL_EVALUATION.md):
 * - Salience: ~24 narrow, grounding-checked picks per run with a
 *   deterministic fallback. The cheap models all scored within noise of
 *   each other, so the cheapest one wins (Adam: OpenAI for cheap tasks).
 * - Analyst: one call per month, the step that decides what a healthcare
 *   leader sees first. Opus 5.5 scored highest (0.92, 75% source
 *   citation, top marks on cross-domain synthesis) at about $1/year here.
 */
export const DEFAULT_SALIENCE_MODEL = "openai:gpt-6-luna";
export const DEFAULT_ANALYST_MODEL = "anthropic:claude-opus-5-5";

async function main() {
  const salienceSpec = process.env.SALIENCE_MODEL || DEFAULT_SALIENCE_MODEL;
  const analystSpec = process.env.ANALYST_MODEL || DEFAULT_ANALYST_MODEL;
  const salience = createProviderFromSpec(salienceSpec);
  const analyst = createProviderFromSpec(analystSpec);

  if (!salience) console.log(`[monthly-reasoning] No key for ${salienceSpec} - salience falls back to deterministic ranking.`);
  const outcome = await runMonthlyReasoning({ salience, analyst, force: process.env.FORCE_REASONING === "1" });

  if (outcome.status === "skipped-no-provider") {
    console.log(`[monthly-reasoning] No key for ${analystSpec} - nothing to run, $0 spent.`);
  } else if (outcome.status === "skipped-unchanged") {
    console.log("[monthly-reasoning] No source changed since the last reasoned run - skipped, $0 spent.");
  } else {
    const { analyst: a, changedDatasets } = outcome.run;
    console.log(`[monthly-reasoning] Wrote ${outcome.file}`);
    console.log(`[monthly-reasoning] New data: ${changedDatasets.join(", ") || "none (forced run)"}`);
    console.log(`[monthly-reasoning] Analyst (${a.model}): ${a.topFindings.length} findings, ${a.patterns.length} patterns, briefing ${a.briefing ? "kept" : "none"}, ${a.rejected.length} item(s) rejected by grounding${a.note ? ` - ${a.note}` : ""}`);
  }
}

main().catch((err) => {
  console.error("[monthly-reasoning] failed:", err);
  process.exitCode = 1;
});
