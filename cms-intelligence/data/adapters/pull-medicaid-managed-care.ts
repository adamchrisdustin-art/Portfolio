/**
 * One-shot CLI to run medicaidManagedCare.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-medicaid-managed-care.ts
 * About 16 small pages from data.medicaid.gov's public API. Zero API-key
 * cost - no LLM call.
 */
import { fetchAndSnapshot } from "./medicaidManagedCare";

async function main() {
  console.log("[pull-medicaid-managed-care] pulling Medicaid Managed Care Enrollment by Program and Plan...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-medicaid-managed-care] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-medicaid-managed-care] failed:", err);
  process.exitCode = 1;
});
