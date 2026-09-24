/**
 * One-shot CLI to run clinicalTrialsResults.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-clinicaltrials-results.ts
 * Zero API-key cost - public clinicaltrials.gov data, no LLM call.
 */
import { fetchAndSnapshot } from "./clinicalTrialsResults";

async function main() {
  console.log("[pull-clinicaltrials-results] fetching industry-sponsored Phase 3 trials with newly posted results...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-clinicaltrials-results] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-clinicaltrials-results] failed:", err);
  process.exitCode = 1;
});
