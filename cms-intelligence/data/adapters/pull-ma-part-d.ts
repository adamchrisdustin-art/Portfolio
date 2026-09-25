/**
 * One-shot CLI to run maPartDEnrollment.ts's live pull, then backfill any
 * monthly history not yet on disk (maPartDHistory.ts).
 *   npx tsx cms-intelligence/data/adapters/pull-ma-part-d.ts
 * Zero API-key cost - public cms.gov data, no LLM call.
 */
import { fetchAndSnapshot } from "./maPartDEnrollment";
import { backfillMonths } from "./maPartDHistory";

async function main() {
  console.log("[pull-ma-part-d] fetching CMS Medicare Advantage/Part D Monthly Enrollment by Plan...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-ma-part-d] wrote ${file}`);
  const written = await backfillMonths();
  console.log(`[pull-ma-part-d] monthly history: ${written.length} new month(s) summarized`);
}

main().catch((err) => {
  console.error("[pull-ma-part-d] failed:", err);
  process.exitCode = 1;
});
