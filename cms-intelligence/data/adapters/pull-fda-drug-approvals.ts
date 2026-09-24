/**
 * One-shot CLI to run fdaDrugApprovals.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-fda-drug-approvals.ts
 * Zero API-key cost - public api.fda.gov data, no LLM call.
 */
import { fetchAndSnapshot } from "./fdaDrugApprovals";

async function main() {
  console.log("[pull-fda-drug-approvals] fetching openFDA novel drug approvals...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-fda-drug-approvals] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-fda-drug-approvals] failed:", err);
  process.exitCode = 1;
});
