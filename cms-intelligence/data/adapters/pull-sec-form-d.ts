/**
 * One-shot CLI to run secFormD.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-sec-form-d.ts
 * Reads SEC's Form D data sets page and the latest 8 quarterly zips
 * (about 30MB in total, 9 requests). Zero API-key cost, no LLM call.
 */
import { fetchAndSnapshot } from "./secFormD";

async function main() {
  console.log("[pull-sec-form-d] pulling SEC Form D data sets (health-care offerings, latest 8 quarters)...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-sec-form-d] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-sec-form-d] failed:", err);
  process.exitCode = 1;
});
