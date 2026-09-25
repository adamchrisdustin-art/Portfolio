import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { bottomPickingProvider, inventingProvider, withoutGeneratedAt } from "../../intelligence/salience/testProviders";
import { loadAllYears } from "../../data/adapters/physicianByProviderSummary";
import type { Insight } from "../../intelligence/evidence/schema";
import { claimsUtilizationCostAgent } from "./agent";

const homeHealth = (insights: Insight[]) => insights.find((i) => i.id.endsWith("home-health-spending-ratio"))!;
const physician = (insights: Insight[]) => insights.filter((i) => i.sourceIds.includes("cms:medicare-physician-by-provider"));

/** Runs against the real CMS Home Health Care Agencies snapshots and physician summary tables already committed to this repo. */
describe("claimsUtilizationCostAgent", () => {
  it("produces a valid, evidence-backed home health insight from real data", async () => {
    const insight = homeHealth(await claimsUtilizationCostAgent.run({ modelProvider: null }));
    expect(() => validateInsight(insight)).not.toThrow();
    expect(insight.signalType).toBe("baseline"); // days of snapshot history - must never claim "trend"
    expect(insight.magnitude.unit).toBe("ratio-vs-risk-adjusted-expected"); // must not mislabel as a dollar figure
  });

  it("produces national, provider-type and state physician payment-growth insights from every data year", async () => {
    const insights = physician(await claimsUtilizationCostAgent.run({ modelProvider: null }));
    expect(insights.map((i) => i.id.replace(/^sig-claims-cost-\d{4}-/, "")).sort()).toEqual([
      "physician-payment-trend",
      "physician-state-growth",
      "physician-type-growth",
    ]);
    const national = insights.find((i) => i.id.endsWith("physician-payment-trend"))!;
    // One point per real data year, never interpolated
    expect(national.series?.points.length).toBe(loadAllYears().length);
    expect(national.headline).toMatch(/services [+-][\d.]+%, payment per service [+-][\d.]+%/);
    for (const insight of insights) expect(() => validateInsight(insight)).not.toThrow();
  });

  it("carries a real per-state boxplot with correctly ordered Tukey whiskers, not raw min/max", async () => {
    const insight = homeHealth(await claimsUtilizationCostAgent.run({ modelProvider: null }));
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

  it("with a model configured, boxplots only real states the model picked, and the national headline is unaffected by that selection", async () => {
    const baseline = homeHealth(await claimsUtilizationCostAgent.run({ modelProvider: null }));
    const provider = bottomPickingProvider();
    const insight = homeHealth(await claimsUtilizationCostAgent.run({ modelProvider: provider }));

    // One salience call for home health states, one each for physician provider types and states
    expect(provider.prompts).toHaveLength(3);
    expect(() => validateInsight(insight)).not.toThrow();
    expect(insight.headline).toBe(baseline.headline);
    expect(insight.magnitude).toEqual(baseline.magnitude);
    if (insight.chart?.type !== "boxplot" || baseline.chart?.type !== "boxplot") throw new Error("expected boxplots");
    expect(insight.chart.title).toMatch(/selected as most noteworthy/);
    const labels = insight.chart.boxes.map((b) => b.label);
    expect(new Set(labels)).not.toEqual(new Set(baseline.chart.boxes.map((b) => b.label)));
    for (const box of insight.chart.boxes) {
      expect(provider.prompts.some((p) => p.includes(`id="${box.label}"`))).toBe(true);
      expect(box.sampleSize).toBeGreaterThanOrEqual(30);
    }
    expect(insight.drivers[0].description).toMatch(/model-reasoned salience ranking/);
  });

  it("falls back to its exact no-model output when the model invents a candidate", async () => {
    const baseline = await claimsUtilizationCostAgent.run({ modelProvider: null });
    const insights = await claimsUtilizationCostAgent.run({ modelProvider: inventingProvider() });
    expect(withoutGeneratedAt(insights)).toEqual(withoutGeneratedAt(baseline));
  });
});
