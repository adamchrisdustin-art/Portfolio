/**
 * One-shot CLI to run medicaidEnrollment.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-medicaid-enrollment.ts
 * About two dozen small pages from data.medicaid.gov's public API. Zero
 * API-key cost - no LLM call.
 */
import { fetchAndSnapshot } from "./medicaidEnrollment";

async function main() {
  console.log("[pull-medicaid-enrollment] pulling State Medicaid and CHIP enrollment data (every state and DC, monthly)...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-medicaid-enrollment] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-medicaid-enrollment] failed:", err);
  process.exitCode = 1;
});
