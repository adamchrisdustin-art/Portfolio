/**
 * One-shot CLI to run physicianFeeSchedule.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-physician-fee-schedule.ts
 * First run downloads one release zip per year from 2013 (about 6MB each);
 * later runs only download a year whose latest quarterly release changed.
 * Public CMS files, no API key, no LLM call.
 */
import { fetchAndSnapshot } from "./physicianFeeSchedule";

async function main() {
  console.log("[pull-fee-schedule] reading CMS Physician Fee Schedule national RVU files (latest release per year, 2013 onward)...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-fee-schedule] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-fee-schedule] failed:", err);
  process.exitCode = 1;
});
