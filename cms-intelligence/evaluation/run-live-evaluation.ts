/**
 * Runs the real benchmark suite against whichever real provider(s) have
 * an API key configured, and writes results + a comparison report to
 * disk. THIS SCRIPT MAKES REAL, BILLED API CALLS - it is the one
 * deliberate on-ramp to actual spend for this evaluation framework (see
 * costModel.ts for the real per-call cost, on the order of a fraction of
 * a cent per task at current Haiku/gpt-4o-mini pricing - the full
 * 12-task suite through both providers is well under $0.05 total).
 *
 * Per COST_AND_OPERATING_MODEL.md's explicit Phase 6 resolution: this
 * should not run before the Phase 4/5 data-source backfill is safely
 * complete, so it doesn't compete with that work for the same $100
 * credit. Not wired into any GitHub Actions workflow and not invoked by
 * any other script - run it manually, on purpose:
 *   npx tsx cms-intelligence/evaluation/run-live-evaluation.ts
 *
 * Exits cleanly with a message (not an error) if no key is configured -
 * matching every other provider-gated code path in this repo.
 */
import fs from "node:fs";
import path from "node:path";
import { createAnthropicProvider } from "../providers/anthropic";
import { createOpenAIProvider } from "../providers/openai";
import type { ModelProvider } from "../providers/types";
import { buildComparisonReport } from "./comparisonReport";
import { runSuite } from "./runner";
import type { ProviderRunResult } from "./types";

const RESULTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", "evaluation-runs");

function configuredProviders(): ModelProvider[] {
  const providers: ModelProvider[] = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push(createAnthropicProvider(process.env.ANTHROPIC_API_KEY));
  if (process.env.OPENAI_API_KEY) providers.push(createOpenAIProvider(process.env.OPENAI_API_KEY));
  return providers;
}

async function main() {
  const providers = configuredProviders();
  if (providers.length === 0) {
    console.log("[run-live-evaluation] No ANTHROPIC_API_KEY or OPENAI_API_KEY configured - nothing to run, $0 spent. Set at least one to run the live evaluation.");
    return;
  }

  console.log(`[run-live-evaluation] Running the 12-task benchmark suite through ${providers.length} configured provider(s): ${providers.map((p) => p.name).join(", ")}`);
  console.log("[run-live-evaluation] This makes real, billed API calls - see this file's header comment for the expected cost.");

  const runs: ProviderRunResult[] = [];
  for (const provider of providers) {
    console.log(`[run-live-evaluation] Running suite through ${provider.name}...`);
    runs.push(await runSuite(provider));
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);

  const resultsFile = path.join(RESULTS_DIR, `${stamp}-results.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(runs, null, 2));
  console.log(`[run-live-evaluation] wrote ${resultsFile}`);

  const reportFile = path.join(RESULTS_DIR, `${stamp}-comparison-report.md`);
  fs.writeFileSync(reportFile, buildComparisonReport(runs));
  console.log(`[run-live-evaluation] wrote ${reportFile}`);
}

main().catch((err) => {
  console.error("[run-live-evaluation] failed:", err);
  process.exitCode = 1;
});
