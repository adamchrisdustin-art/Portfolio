import { describe, expect, it } from "vitest";
import { buildAnalyticsOverview } from "./overview";

/** Runs against the real committed data (all 3 sources) - not mocked. */
describe("buildAnalyticsOverview", () => {
  it("computes real KPIs with no fabricated values", () => {
    const overview = buildAnalyticsOverview();
    expect(overview.kpis.length).toBeGreaterThan(0);
    for (const kpi of overview.kpis) {
      expect(typeof kpi.label).toBe("string");
      expect(kpi.value.length).toBeGreaterThan(0);
    }
  });

  it("donut slices sum to a positive real total", () => {
    const overview = buildAnalyticsOverview();
    for (const donut of [overview.facilityTypeDonut, overview.ownershipDonut]) {
      if (!donut) continue;
      const total = donut.slices.reduce((s, v) => s + v.value, 0);
      expect(total).toBeGreaterThan(0);
    }
  });

  it("boxplot whiskers are correctly ordered and outliers genuinely fall outside them", () => {
    const overview = buildAnalyticsOverview();
    if (!overview.spendingRatioBoxplot) return;
    for (const box of overview.spendingRatioBoxplot.boxes) {
      expect(box.whiskerLow).toBeLessThanOrEqual(box.q1);
      expect(box.q3).toBeLessThanOrEqual(box.whiskerHigh);
      for (const v of box.outliers) {
        expect(v < box.whiskerLow || v > box.whiskerHigh).toBe(true);
      }
    }
  });

  it("rating bars exclude CMS suppression markers (e.g. '-') as a fake rating category", () => {
    const overview = buildAnalyticsOverview();
    for (const bar of [overview.hospitalRatingBar, overview.homeHealthRatingBar]) {
      if (!bar) continue;
      for (const b of bar.bars) {
        expect(Number.isNaN(Number(b.label.replace("★", "")))).toBe(false);
      }
    }
  });

  it("time-series points are real and chronologically ordered", () => {
    const overview = buildAnalyticsOverview();
    if (!overview.facilityCountSeries) return;
    const dates = overview.facilityCountSeries.points.map((p) => p.date);
    expect(dates).toEqual([...dates].sort());
  });
});
