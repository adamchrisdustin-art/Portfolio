/**
 * One-shot CLI to run nihReporterAwards.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-nih-reporter-awards.ts
 * Zero API-key cost - public api.reporter.nih.gov data, no LLM call.
 */
import { fetchAndSnapshot } from "./nihReporterAwards";

async function main() {
  console.log("[pull-nih-reporter-awards] fetching NIH RePORTER award notices...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-nih-reporter-awards] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-nih-reporter-awards] failed:", err);
  process.exitCode = 1;
});
