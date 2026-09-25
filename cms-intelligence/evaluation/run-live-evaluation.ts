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
 *
 * ANTHROPIC_MODEL (optional): a comma-separated list of Anthropic model
 * IDs to run the suite through instead of just the default (Haiku) -
 * e.g. ANTHROPIC_MODEL=claude-sonnet-5,claude-opus-5-5 to compare tiers
 * in one run. Each listed model becomes its own row in the report.
 * OPENAI_MODEL works the same way for OpenAI (default gpt-4o-mini).
 *
 * Output is timestamped down to the second (not just the date), so
 * multiple real runs on the same calendar day never silently overwrite
 * each other's results - a real gap fixed 2026-09-25 after the first
 * same-day rerun would have clobbered the prior run's file.
 */
import fs from "node:fs";
import path from "node:path";
import { buildComparisonReport } from "./comparisonReport";
import { configuredProviders } from "./configuredProviders";
import { runSuite } from "./runner";
import type { ProviderRunResult } from "./types";

const RESULTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", "evaluation-runs");


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
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19); // e.g. 2026-09-25T14-32-07

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
