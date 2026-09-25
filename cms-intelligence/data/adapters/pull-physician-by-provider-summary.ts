/**
 * One-shot CLI to run physicianByProviderSummary.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-physician-by-provider-summary.ts [--refresh-latest]
 * First run pulls every data year (about 5 minutes per year); later runs
 * only pull years not yet on disk. Zero API-key cost - public CMS data,
 * no LLM call.
 */
import { fetchAndSnapshot } from "./physicianByProviderSummary";

async function main() {
  console.log("[pull-physician-summary] summarizing CMS Medicare Physician & Other Practitioners - by Provider (every provider, every data year)...");
  const file = await fetchAndSnapshot({ refreshLatest: process.argv.includes("--refresh-latest") });
  console.log(`[pull-physician-summary] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-physician-summary] failed:", err);
  process.exitCode = 1;
});
