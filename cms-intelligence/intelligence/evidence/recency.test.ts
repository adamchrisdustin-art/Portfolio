import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SOURCE_LABELS } from "../../data/sources/sourceLabels";
import { fingerprintSnapshot, unchangedSinceBySource } from "../../reasoning/sourceFingerprints";
import { applyRecency, overdueMonths, SOURCE_TIMING, tierFor } from "./recency";
import type { Insight } from "./schema";

const NOW = new Date("2026-09-26T00:00:00Z");
const insight = (sourceIds: string[], periodEnd: string) =>
  ({ id: "i", sourceIds, period: { start: "2020-01-01", end: periodEnd }, freshness: { dataAsOf: "2026-09-26", generatedAt: "", isStale: false } }) as unknown as Insight;

describe("tierFor", () => {
  it("is current up to 12 months overdue, aging to 24, stale beyond", () => {
    expect(tierFor(-3)).toBe("current");
    expect(tierFor(12)).toBe("current");
    expect(tierFor(12.1)).toBe("aging");
    expect(tierFor(24)).toBe("aging");
    expect(tierFor(24.1)).toBe("stale");
  });
});

describe("overdueMonths", () => {
  const physician = SOURCE_TIMING["cms:medicare-physician-by-provider"];

  it("doesn't count a late-publishing source's normal delay: 2024 physician data is on time in September 2026", () => {
    expect(overdueMonths({ periodEnd: "2024-12-31", unchangedSince: null, timing: physician, now: NOW })).toBeLessThan(0);
  });

  it("counts time past when the next update was due", () => {
    // 2024 data with no 2025 release by September 2028: about 16 months past due.
    const overdue = overdueMonths({ periodEnd: "2024-12-31", unchangedSince: null, timing: physician, now: new Date("2028-09-26") });
    expect(tierFor(overdue)).toBe("aging");
  });

  it("catches a source pulled whole each time that stopped changing, even though its dates look new", () => {
    const hospitals = SOURCE_TIMING["cms:hospital-general-information"];
    const overdue = overdueMonths({ periodEnd: "2026-09-25", unchangedSince: "2024-01-01", timing: hospitals, now: NOW });
    expect(tierFor(overdue)).toBe("stale");
  });
});

describe("applyRecency", () => {
  it("marks stale insights and takes a multi-source insight's most overdue source", () => {
    const [fresh, stale, mixed] = applyRecency(
      [
        insight(["federal-register:cms-documents"], "2026-09-25"),
        insight(["cms:medicaid-managed-care-plans"], "2021-12-31"),
        insight(["federal-register:cms-documents", "cms:medicaid-managed-care-plans"], "2021-12-31"),
      ],
      NOW,
      {}
    );
    expect(fresh.freshness).toMatchObject({ recency: "current", isStale: false });
    expect(stale.freshness).toMatchObject({ recency: "stale", isStale: true });
    expect(mixed.freshness.recency).toBe("stale");
  });

  it("becomes current again as soon as a stale source publishes newer data", () => {
    const [before] = applyRecency([insight(["cms:medicaid-managed-care-plans"], "2021-12-31")], NOW, {});
    const [after] = applyRecency([insight(["cms:medicaid-managed-care-plans"], "2025-12-31")], NOW, {});
    expect(before.freshness.recency).toBe("stale");
    expect(after.freshness.recency).toBe("current");
  });

  it("treats a source without timing as current rather than guessing", () => {
    expect(applyRecency([insight(["unknown:source"], "2010-01-01")], NOW, {})[0].freshness.recency).toBe("current");
  });
});

describe("SOURCE_TIMING", () => {
  it("covers every source the dashboard can show", () => {
    for (const sourceId of Object.keys(SOURCE_LABELS)) expect(SOURCE_TIMING[sourceId], sourceId).toBeDefined();
  });
});

describe("unchangedSinceBySource", () => {
  it("returns the earliest snapshot date whose content matches the latest", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "recency-"));
    const write = (date: string, value: number) => fs.writeFileSync(path.join(dir, `${date}.json`), JSON.stringify({ pulledAt: `${date}T00:00:00Z`, value }));
    write("2026-06-01", 1);
    write("2026-07-01", 2);
    write("2026-08-01", 2);
    write("2026-09-01", 2);
    expect(fingerprintSnapshot({ pulledAt: "a", value: 2 })).toBe(fingerprintSnapshot({ pulledAt: "b", value: 2 }));
    expect(unchangedSinceBySource({ "federal-register-documents": dir })).toEqual({ "federal-register:cms-documents": "2026-07-01" });
  });
});
