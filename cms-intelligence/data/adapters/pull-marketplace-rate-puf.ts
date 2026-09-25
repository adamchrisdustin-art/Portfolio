/**
 * One-shot CLI to run marketplaceRatePuf.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-marketplace-rate-puf.ts
 * First run summarizes every plan year from 2014 (about 2 minutes); later runs
 * re-check the newest year and add new ones. Zero API-key cost - public
 * cms.gov files, no LLM call. Each Rate PUF is streamed, never stored.
 */
import { fetchAndSnapshot } from "./marketplaceRatePuf";

async function main() {
  console.log("[pull-marketplace-rate-puf] summarizing CMS Marketplace Rate + Plan Attributes PUFs, every HealthCare.gov state and plan year...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-marketplace-rate-puf] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-marketplace-rate-puf] failed:", err);
  process.exitCode = 1;
});
