/**
 * Monthly watch-list check for the Data Source & CMS Change Monitor
 * (data/sources/watchlist.ts). Run by the monthly workflow:
 *   npx tsx cms-intelligence/agents/source-change-monitor/check-watchlist.ts
 * Writes data/healthcare-intelligence/watchlist/status.json (committed with
 * the monthly pull) and, when a watched dataset has new data, a GitHub
 * Actions warning so it shows on the run's summary page. Free: one small
 * public API call per dataset, no LLM call.
 */
import fs from "node:fs";
import path from "node:path";
import { checkWatchlist } from "../../data/sources/watchlist";

const STATUS_FILE = path.resolve(process.cwd(), "data", "healthcare-intelligence", "watchlist", "status.json");

async function main() {
  const results = await checkWatchlist();
  for (const r of results) {
    console.log(`[watchlist] ${r.id}: ${r.message}`);
    // GitHub Actions annotation; plain text anywhere else.
    if (r.status === "new-data") console.log(`::warning title=Watched dataset has new data::${r.title}: ${r.message}`);
  }
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
}

main().catch((err) => {
  console.error("[watchlist] failed:", err);
  process.exitCode = 1;
});
