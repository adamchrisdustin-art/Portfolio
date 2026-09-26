/**
 * One-shot CLI to run facilityOwnership.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-facility-ownership.ts
 * Pulls the latest hospital and SNF change-of-ownership and owner files,
 * plus every monthly All Owners version with the private equity flag not
 * yet on disk (PE-flagged rows only). Zero API-key cost - public CMS data,
 * no LLM call.
 */
import { fetchAndSnapshot } from "./facilityOwnership";

async function main() {
  console.log("[pull-facility-ownership] pulling CMS hospital and SNF change-of-ownership and owner files...");
  const files = await fetchAndSnapshot();
  console.log(`[pull-facility-ownership] wrote ${files.join(", ")}`);
}

main().catch((err) => {
  console.error("[pull-facility-ownership] failed:", err);
  process.exitCode = 1;
});
