/**
 * One-shot CLI to run secHealthIndustry8k.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-sec-health-industry-8k.ts
 * About 400-600 EDGAR full-text search requests (24 health SIC codes,
 * quarter-sized date ranges, 100 hits per page), paced under SEC's 10
 * requests/second limit - a few minutes. Zero API-key cost, no LLM call.
 */
import { fetchAndSnapshot } from "./secHealthIndustry8k";

async function main() {
  console.log("[pull-sec-health-industry-8k] pulling 8-K filings for every health-industry SIC code...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-sec-health-industry-8k] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-sec-health-industry-8k] failed:", err);
  process.exitCode = 1;
});
