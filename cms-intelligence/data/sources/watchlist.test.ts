import { describe, expect, it } from "vitest";
import { checkWatchlist, WATCHED_DATASETS, type WatchedDataset } from "./watchlist";

const dataset: WatchedDataset = { id: "d", title: "D", queryUrl: "https://x/query", periodField: "month", latestSeen: "202212", reason: "", relatedQuestionIds: [] };
const respondWith = (body: unknown, ok = true) => async () => ({ ok, status: ok ? 200 : 503, json: async () => body });

describe("checkWatchlist", () => {
  it("flags a newer period than the one recorded", async () => {
    const [r] = await checkWatchlist([dataset], respondWith({ results: [{ month: "202306" }] }));
    expect(r).toMatchObject({ status: "new-data", latestNow: "202306" });
  });

  it("reports no new data when the latest period is unchanged", async () => {
    const [r] = await checkWatchlist([dataset], respondWith({ results: [{ month: "202212" }] }));
    expect(r.status).toBe("no-new-data");
  });

  it("reports a failed check as unreachable instead of throwing", async () => {
    const [failed] = await checkWatchlist([dataset], respondWith({}, false));
    expect(failed).toMatchObject({ status: "unreachable", latestNow: null });
    const [empty] = await checkWatchlist([dataset], respondWith({ results: [] }));
    expect(empty.status).toBe("unreachable");
  });

  it("asks for only the newest period", async () => {
    let requested = "";
    await checkWatchlist([dataset], async (url) => {
      requested = decodeURIComponent(url);
      return { ok: true, status: 200, json: async () => ({ results: [{ month: "202212" }] }) };
    });
    expect(requested).toContain("limit=1");
    expect(requested).toContain("sorts[0][property]=month");
    expect(requested).toContain("sorts[0][order]=desc");
  });

  it("watches the T-MSIS dual-status dataset from its December 2022 vintage", () => {
    expect(WATCHED_DATASETS.map((d) => [d.id, d.latestSeen])).toEqual([["medicaid-gov:dual-status-by-month", "202212"]]);
  });
});
