/**
 * One-shot CLI to run homeHealthCareAgencies.ts's live pull. Mirrors
 * pipeline/pullCmsData.ts's role for its own dataset. Run via:
 *   npx tsx cms-intelligence/data/adapters/pull-home-health.ts
 * Zero API-key cost (public CMS data, no LLM call) - safe to (re)run any
 * time without touching the Anthropic/OpenAI credit budget.
 */
import { fetchAndSnapshot } from "./homeHealthCareAgencies";

async function main() {
  console.log("[pull-home-health] fetching CMS Home Health Care Agencies dataset...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-home-health] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-home-health] failed:", err);
  process.exitCode = 1;
});
