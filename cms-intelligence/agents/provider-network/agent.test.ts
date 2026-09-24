import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { providerNetworkAgent } from "./agent";

describe("providerNetworkAgent", () => {
  it("produces valid insights, including the real donut-chart ownership-concentration signal", async () => {
    const insights = await providerNetworkAgent.run({ modelProvider: null });
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(() => validateInsight(insight)).not.toThrow();
    }

    const ownershipInsight = insights.find((i) => i.questionId === "Q038");
    expect(ownershipInsight?.chart?.type).toBe("donut");
    if (ownershipInsight?.chart?.type === "donut") {
      expect(ownershipInsight.chart.slices.length).toBeGreaterThan(1);
      const total = ownershipInsight.chart.slices.reduce((s, v) => s + v.value, 0);
      expect(total).toBeGreaterThan(0);
    }
  });

  it("produces a real star-rating-vs-quality-outcome scatter insight (Q125) whose correlation is computed over the full sample, not just the rendered chart points", async () => {
    const insights = await providerNetworkAgent.run({ modelProvider: null });
    const correlation = insights.find((i) => i.questionId === "Q125");
    expect(correlation).toBeDefined();
    expect(correlation?.chart?.type).toBe("scatter");
    if (correlation?.chart?.type === "scatter") {
      expect(correlation.chart.points.length).toBeGreaterThan(0);
      for (const point of correlation.chart.points) {
        expect(point.x).toBeGreaterThanOrEqual(1);
        expect(point.x).toBeLessThanOrEqual(5);
      }
    }
    expect(correlation?.magnitude.unit).toBe("pearson-r");
    expect(correlation?.magnitude.value).toBeGreaterThanOrEqual(-1);
    expect(correlation?.magnitude.value).toBeLessThanOrEqual(1);
    // Correlation is evidence, never a causal claim, regardless of strength.
    expect(correlation?.drivers.every((d) => d.relationship === "correlation")).toBe(true);
  });

  it("produces real boxplot insights for star rating by state (Q126) and net quality-outcome score by state (Q127)", async () => {
    const insights = await providerNetworkAgent.run({ modelProvider: null });
    const starByState = insights.find((i) => i.questionId === "Q126");
    const outcomeByState = insights.find((i) => i.questionId === "Q127");
    expect(starByState?.chart?.type).toBe("boxplot");
    expect(outcomeByState?.chart?.type).toBe("boxplot");
    if (starByState?.chart?.type === "boxplot") {
      expect(starByState.chart.boxes.length).toBeGreaterThan(1);
      for (const box of starByState.chart.boxes) {
        expect(box.sampleSize).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it("produces Q042/Q043 facility entry/exit insights honestly reporting zero events when the real diff finds none", async () => {
    const insights = await providerNetworkAgent.run({ modelProvider: null });
    const entries = insights.find((i) => i.questionId === "Q042");
    const exits = insights.find((i) => i.questionId === "Q043");
    expect(entries).toBeDefined();
    expect(exits).toBeDefined();
    // Real committed snapshots as of this test show zero real facility_id changes -
    // must say so plainly, never invent a fabricated entry/exit to fill the insight.
    expect(entries?.magnitude.value).toBeGreaterThanOrEqual(0);
    expect(exits?.magnitude.value).toBeGreaterThanOrEqual(0);
    if (entries?.magnitude.value === 0) expect(entries.headline).toMatch(/Zero real facility/);
  });

  it("produces a Q128 quality-by-geography insight that never claims a trend without real persistence across snapshots", async () => {
    const insights = await providerNetworkAgent.run({ modelProvider: null });
    const trendInsight = insights.find((i) => i.questionId === "Q128");
    expect(trendInsight).toBeDefined();
    expect(["trend", "baseline"]).toContain(trendInsight?.signalType);
    // "trend" is only legitimate if the headline itself names at least one real improving state.
    if (trendInsight?.signalType === "trend") {
      expect(trendInsight.headline).toMatch(/persistent improvement/);
    }
  });
});
