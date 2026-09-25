/**
 * One-shot CLI to run marketplaceEnrollment.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-marketplace-enrollment.ts
 * Pulls every open enrollment year's state-level file not yet on disk
 * (small zips, seconds each) and re-checks the newest. Zero API-key
 * cost - public cms.gov files, no LLM call.
 */
import { fetchAndSnapshot } from "./marketplaceEnrollment";

async function main() {
  console.log("[pull-marketplace-enrollment] pulling CMS Marketplace Open Enrollment state-level PUFs (every state and DC)...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-marketplace-enrollment] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-marketplace-enrollment] failed:", err);
  process.exitCode = 1;
});
