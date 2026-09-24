/**
 * One-shot CLI to run federalRegisterDocuments.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-federal-register.ts
 * Zero API-key cost - public federalregister.gov data, no LLM call.
 */
import { fetchAndSnapshot } from "./federalRegisterDocuments";

async function main() {
  console.log("[pull-federal-register] fetching Federal Register CMS documents...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-federal-register] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-federal-register] failed:", err);
  process.exitCode = 1;
});
