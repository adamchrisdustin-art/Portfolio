/**
 * One-shot CLI to run maPartDEnrollment.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-ma-part-d.ts
 * Zero API-key cost - public cms.gov data, no LLM call.
 */
import { fetchAndSnapshot } from "./maPartDEnrollment";

async function main() {
  console.log("[pull-ma-part-d] fetching CMS Medicare Advantage/Part D Monthly Enrollment by Plan...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-ma-part-d] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-ma-part-d] failed:", err);
  process.exitCode = 1;
});
