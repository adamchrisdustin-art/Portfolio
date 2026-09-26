/**
 * One-shot CLI to run providerOfServices.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-provider-of-services.ts [--refresh-latest]
 * First run pulls every quarterly QIES and iQIES file (about 50 files);
 * later runs only pull quarters not yet on disk. Zero API-key cost -
 * public CMS data, no LLM call.
 */
import { fetchAndSnapshot } from "./providerOfServices";

async function main() {
  console.log("[pull-provider-of-services] summarizing CMS Provider of Services files (QIES and iQIES, every quarter)...");
  const file = await fetchAndSnapshot({ refreshLatest: process.argv.includes("--refresh-latest") });
  console.log(`[pull-provider-of-services] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-provider-of-services] failed:", err);
  process.exitCode = 1;
});
