/**
 * One-shot CLI to run physicianServiceSummary.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-physician-service-summary.ts
 * First run pulls every data year (3 requests each); later runs only pull
 * years not yet on disk, plus the current category map. Zero API-key
 * cost - public CMS data, no LLM call.
 */
import { fetchAndSnapshot } from "./physicianServiceSummary";

async function main() {
  console.log("[pull-service-summary] summarizing CMS Medicare Physician & Other Practitioners - by Geography and Service (national, every data year)...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-service-summary] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-service-summary] failed:", err);
  process.exitCode = 1;
});
