import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { claimsUtilizationCostAgent } from "./agent";

/** Runs against the real CMS Home Health Care Agencies snapshot already committed to this repo. */
describe("claimsUtilizationCostAgent", () => {
  it("produces a valid, evidence-backed insight from real data", async () => {
    const insights = await claimsUtilizationCostAgent.run({ modelProvider: null });
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(() => validateInsight(insight)).not.toThrow();
      expect(insight.signalType).toBe("baseline"); // only one snapshot exists - must never claim "trend"
      expect(insight.magnitude.unit).toBe("ratio-vs-risk-adjusted-expected"); // must not mislabel as a dollar figure
    }
  });

  it("carries a real per-state boxplot with correctly ordered Tukey whiskers, not raw min/max", async () => {
    const insights = await claimsUtilizationCostAgent.run({ modelProvider: null });
    const insight = insights[0];
    expect(insight.chart?.type).toBe("boxplot");
    if (insight.chart?.type === "boxplot") {
      expect(insight.chart.boxes.length).toBeGreaterThan(0);
      for (const box of insight.chart.boxes) {
        expect(box.whiskerLow).toBeLessThanOrEqual(box.q1);
        expect(box.q1).toBeLessThanOrEqual(box.median);
        expect(box.median).toBeLessThanOrEqual(box.q3);
        expect(box.q3).toBeLessThanOrEqual(box.whiskerHigh);
        expect(box.sampleSize).toBeGreaterThan(0);
        expect(Array.isArray(box.outliers)).toBe(true);
        // Every outlier must genuinely fall outside the whisker range, never a fabricated point
        for (const v of box.outliers) {
          expect(v < box.whiskerLow || v > box.whiskerHigh).toBe(true);
        }
      }
    }
  });
});
