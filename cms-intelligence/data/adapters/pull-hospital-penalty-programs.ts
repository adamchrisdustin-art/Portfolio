/**
 * One-shot CLI to run hospitalPenaltyPrograms.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-hospital-penalty-programs.ts
 * Three Provider Data Catalog datasets plus two small IPPS final-rule
 * tables. Public CMS data, no API key, no LLM call.
 */
import { fetchAndSnapshot } from "./hospitalPenaltyPrograms";

async function main() {
  console.log("[pull-hospital-penalties] reading CMS HRRP, HAC Reduction and Hospital VBP data plus IPPS Tables 15 and 16B...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-hospital-penalties] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-hospital-penalties] failed:", err);
  process.exitCode = 1;
});
