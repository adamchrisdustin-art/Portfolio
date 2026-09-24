/**
 * One-shot CLI to run physicianOtherPractitioners.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-physician-other-practitioners.ts
 * Zero API-key cost - public CMS data, no LLM call.
 */
import { fetchAndSnapshot } from "./physicianOtherPractitioners";

async function main() {
  console.log("[pull-physician] fetching CMS Medicare Physician & Other Practitioners (5-state sample)...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-physician] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-physician] failed:", err);
  process.exitCode = 1;
});
