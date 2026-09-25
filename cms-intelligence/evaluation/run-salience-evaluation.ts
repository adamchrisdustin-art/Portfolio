/**
 * Runs the salience benchmark (salienceBenchmark.ts) through real models.
 * MAKES REAL, BILLED API CALLS - a few cents for six models. Same env
 * handling as run-live-evaluation.ts:
 *   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... \
 *   ANTHROPIC_MODEL=claude-haiku-4-5-20251001,claude-sonnet-5,claude-opus-5-5 \
 *   OPENAI_MODEL=gpt-4o-mini,gpt-6-luna,gpt-6-sol \
 *   npx tsx cms-intelligence/evaluation/run-salience-evaluation.ts
 */
import fs from "node:fs";
import path from "node:path";
import { configuredProviders } from "./configuredProviders";
import { buildSalienceReport, captureSalienceCalls, runSalienceBenchmark, type SalienceRun } from "./salienceBenchmark";

const RESULTS_DIR = path.resolve(process.cwd(), "data", "healthcare-intelligence", "evaluation-runs");

async function main() {
  const providers = configuredProviders();
  if (providers.length === 0) {
    console.log("[salience-evaluation] No ANTHROPIC_API_KEY or OPENAI_API_KEY configured - nothing to run, $0 spent.");
    return;
  }

  const calls = await captureSalienceCalls();
  console.log(`[salience-evaluation] Captured ${calls.length} real salience prompts. Running through: ${providers.map((p) => p.name).join(", ")}`);

  const runs: SalienceRun[] = [];
  for (const provider of providers) {
    console.log(`[salience-evaluation] ${provider.name}...`);
    runs.push(await runSalienceBenchmark(provider, calls));
  }

  const failedProviders = runs.filter((r) => r.results.every((x) => x.rawOutput === null)).map((r) => r.providerName);
  if (failedProviders.length === runs.length) {
    console.error("[salience-evaluation] Every call to every model failed - usually a bad or placeholder API key (see the 401s above). Nothing written.");
    process.exitCode = 1;
    return;
  }
  if (failedProviders.length > 0) console.warn(`[salience-evaluation] Every call failed for: ${failedProviders.join(", ")} - check that provider's key.`);

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const resultsFile = path.join(RESULTS_DIR, `${stamp}-salience-results.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(runs, null, 2));
  fs.writeFileSync(resultsFile.replace(/-results\.json$/, "-report.md"), buildSalienceReport(runs));
  console.log(`[salience-evaluation] wrote ${resultsFile}`);
}

main().catch((err) => {
  console.error("[salience-evaluation] failed:", err);
  process.exitCode = 1;
});
