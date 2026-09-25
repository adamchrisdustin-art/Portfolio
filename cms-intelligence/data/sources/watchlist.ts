/**
 * Datasets we deliberately don't use yet, watched for updates (added
 * 2026-09-25, per Adam). The rule: only data that can be compared with
 * current data goes on the dashboard. A dataset that stopped updating
 * years ago stays off it, and the Data Source & CMS Change Monitor
 * checks monthly whether it has resumed. A newer period than the one
 * recorded here is flagged for a person to decide on; nothing is pulled
 * automatically.
 */

export interface WatchedDataset {
  id: string;
  title: string;
  /** data.medicaid.gov / DKAN datastore query endpoint. */
  queryUrl: string;
  /** Field holding the period, sortable as text (e.g. "202212"). */
  periodField: string;
  /** Latest period seen when the dataset was put on the watch list. */
  latestSeen: string;
  /** Why it isn't used now, and what it would answer. */
  reason: string;
  relatedQuestionIds: string[];
}

export const WATCHED_DATASETS: WatchedDataset[] = [
  {
    id: "medicaid-gov:dual-status-by-month",
    title: "Dual Status Information for Medicaid and CHIP Beneficiaries by Month (T-MSIS Analytic Files)",
    queryUrl: "https://data.medicaid.gov/api/1/datastore/query/36ed6909-ab49-4ca5-a38e-6790138cd613/0",
    periodField: "month",
    latestSeen: "202212",
    reason: "Public T-MSIS-derived monthly dual-eligible counts by state, but the latest month was December 2022 when checked on 2026-09-25, so nothing current to compare with. Would answer Q060 (where dual eligibility is changing).",
    relatedQuestionIds: ["Q060"],
  },
];

export interface WatchResult {
  id: string;
  title: string;
  latestSeen: string;
  latestNow: string | null;
  status: "new-data" | "no-new-data" | "unreachable";
  message: string;
}

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** The dataset's newest period, from one sorted single-row query. */
async function latestPeriod(dataset: WatchedDataset, fetchFn: Fetch): Promise<string | null> {
  const params = new URLSearchParams({ limit: "1", count: "false", schema: "false" });
  params.append("sorts[0][property]", dataset.periodField);
  params.append("sorts[0][order]", "desc");
  params.append("properties[]", dataset.periodField);
  const res = await fetchFn(`${dataset.queryUrl}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { results?: Record<string, unknown>[] };
  const value = body.results?.[0]?.[dataset.periodField];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function checkWatchlist(datasets: WatchedDataset[] = WATCHED_DATASETS, fetchFn: Fetch = fetch): Promise<WatchResult[]> {
  const results: WatchResult[] = [];
  for (const dataset of datasets) {
    const base = { id: dataset.id, title: dataset.title, latestSeen: dataset.latestSeen };
    try {
      const latestNow = await latestPeriod(dataset, fetchFn);
      if (latestNow === null) {
        results.push({ ...base, latestNow, status: "unreachable", message: "The query returned no period value." });
      } else if (latestNow > dataset.latestSeen) {
        results.push({ ...base, latestNow, status: "new-data", message: `New data: latest period is now ${latestNow} (was ${dataset.latestSeen}). Review whether it's current enough to add.` });
      } else {
        results.push({ ...base, latestNow, status: "no-new-data", message: `No new data: latest period is still ${latestNow}.` });
      }
    } catch (err) {
      results.push({ ...base, latestNow: null, status: "unreachable", message: `Check failed: ${(err as Error).message}` });
    }
  }
  return results;
}
