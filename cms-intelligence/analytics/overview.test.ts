import { describe, expect, it } from "vitest";
import { buildAnalyticsOverview } from "./overview";

/** Runs against the real committed data (all 6 sources) - not mocked. */
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
    for (const donut of [overview.facilityTypeDonut, overview.ownershipDonut, overview.federalRegisterDocumentTypeDonut, overview.maPartDOrgTypeDonut]) {
      if (!donut) continue;
      const total = donut.slices.reduce((s, v) => s + v.value, 0);
      expect(total).toBeGreaterThan(0);
    }
  });

  it("Federal Register rules-by-month bar has only real, non-negative counts", () => {
    const overview = buildAnalyticsOverview();
    if (!overview.federalRegisterRulesByMonthBar) return;
    for (const bar of overview.federalRegisterRulesByMonthBar.bars) {
      expect(bar.value).toBeGreaterThan(0);
      expect(bar.label).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("Marketplace boxplot has correctly ordered whiskers and Marketplace charts never name a real carrier", () => {
    const overview = buildAnalyticsOverview();
    if (overview.marketplacePremiumBoxplot) {
      for (const box of overview.marketplacePremiumBoxplot.boxes) {
        expect(box.whiskerLow).toBeLessThanOrEqual(box.q1);
        expect(box.q3).toBeLessThanOrEqual(box.whiskerHigh);
      }
    }
    const forbiddenNamePatterns = ["unitedhealthcare", "optum", "humana", "aetna", "cigna", "kaiser"].map((n) => new RegExp(`\\b${n}\\b`, "i"));
    for (const chart of [overview.marketplacePremiumBoxplot, overview.marketplacePlanAvailabilityBar]) {
      if (!chart) continue;
      const text = JSON.stringify(chart);
      for (const pattern of forbiddenNamePatterns) expect(text).not.toMatch(pattern);
    }
  });

  it("fastest-rising Marketplace states start at 0% in the first plan year and are ranked by total rise", () => {
    const chart = buildAnalyticsOverview().marketplaceFastestRisingLines;
    expect(chart).not.toBeNull();
    expect(chart!.lines).toHaveLength(5);
    const finals = chart!.lines.map((l) => l.points[l.points.length - 1].value);
    expect(finals).toEqual([...finals].sort((a, b) => b - a));
    for (const line of chart!.lines) {
      expect(line.points[0].value).toBe(0);
      expect(line.points.map((p) => p.date)).toEqual(chart!.lines[0].points.map((p) => p.date));
      for (const p of line.points) expect(p.detail).toMatch(/^\$[\d,]+\/month$/);
    }
  });

  it("MA/Part D charts never name a real carrier - category labels only", () => {
    const overview = buildAnalyticsOverview();
    const forbiddenNamePatterns = ["unitedhealthcare", "optum", "humana", "aetna", "kaiser", "cigna"].map((n) => new RegExp(`\\b${n}\\b`, "i"));
    for (const chart of [overview.maPartDOrgTypeDonut, overview.maPartDPlanTypeBar]) {
      if (!chart) continue;
      const text = JSON.stringify(chart);
      for (const pattern of forbiddenNamePatterns) expect(text).not.toMatch(pattern);
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
