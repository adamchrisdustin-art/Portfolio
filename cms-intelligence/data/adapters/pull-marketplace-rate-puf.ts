/**
 * One-shot CLI to run marketplaceRatePuf.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-marketplace-rate-puf.ts
 * Zero API-key cost - public cms.gov data, no LLM call. Downloads a real
 * ~280MB national file transiently to filter it down - takes longer
 * than this repo's other pull scripts, that's expected.
 */
import { fetchAndSnapshot } from "./marketplaceRatePuf";

async function main() {
  console.log("[pull-marketplace-rate-puf] fetching CMS Marketplace Rate PUF (this downloads a large national file, may take a minute)...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-marketplace-rate-puf] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-marketplace-rate-puf] failed:", err);
  process.exitCode = 1;
});
