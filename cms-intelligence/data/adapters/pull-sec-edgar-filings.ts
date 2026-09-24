/**
 * One-shot CLI to run secEdgarFilings.ts's live pull.
 *   npx tsx cms-intelligence/data/adapters/pull-sec-edgar-filings.ts
 * Zero API-key cost - public data.sec.gov data, no LLM call. Makes one
 * request per tracked company (6 total), ~150ms apart per SEC's
 * documented rate-limit courtesy ask.
 */
import { fetchAndSnapshot } from "./secEdgarFilings";

async function main() {
  console.log("[pull-sec-edgar-filings] fetching SEC EDGAR 8-K filings for tracked health insurers...");
  const file = await fetchAndSnapshot();
  console.log(`[pull-sec-edgar-filings] wrote ${file}`);
}

main().catch((err) => {
  console.error("[pull-sec-edgar-filings] failed:", err);
  process.exitCode = 1;
});
