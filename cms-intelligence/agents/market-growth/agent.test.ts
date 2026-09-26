import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { bottomPickingProvider, inventingProvider, TEST_RATIONALE, withoutGeneratedAt } from "../../intelligence/salience/testProviders";
import { marketGrowthAgent } from "./agent";

/** Runs against real committed data: Provider of Services summaries + Home Health Care Agencies. */
describe("marketGrowthAgent", () => {
  it("returns certified-bed, facility-type and home-health capacity insights", async () => {
    const insights = await marketGrowthAgent.run({ modelProvider: null });
    const stems = insights.map((i) => i.id.replace(/^sig-market-growth-\d{4}-\d{2}-\d{2}-/, ""));
    expect(stems).toEqual(["hospital-beds-by-state", "facility-count-by-type", "nursing-home-beds-by-state", "home-health-capacity-signal"]);
    for (const insight of insights) expect(() => validateInsight(insight)).not.toThrow();
  });

  it("bed insights carry a real multi-year series and a period that starts at the comparison year", async () => {
    const insights = await marketGrowthAgent.run({ modelProvider: null });
    for (const stem of ["hospital-beds-by-state", "nursing-home-beds-by-state"]) {
      const insight = insights.find((i) => i.id.endsWith(stem))!;
      expect(insight.series!.points.length).toBeGreaterThanOrEqual(10);
      expect(insight.period.start).toBe(`${insight.series!.points[0].date.slice(0, 4)}-10-01`);
      expect(insight.period.end).toBe(insight.series!.points.at(-1)!.date);
      expect(insight.magnitude.unit).toBe("percent");
      // The headline's national change is the series' fourth-quarter change, not the latest partial year.
      const q4 = insight.series!.points.filter((p) => p.date.endsWith("12-31"));
      expect(insight.magnitude.value).toBeCloseTo(Math.round((q4.at(-1)!.value / q4[0].value - 1) * 1000) / 10, 5);
    }
  });

  it("facility-type counts start before the pandemic and compare closures only at the same reporting lag", async () => {
    const insights = await marketGrowthAgent.run({ modelProvider: null });
    const types = insights.find((i) => i.id.endsWith("facility-count-by-type"))!;
    expect(types.period.start).toBe("2019-10-01");
    expect(types.drivers.map((d) => d.description).join(" ")).toMatch(/as recorded one year earlier/);
    expect(types.limitations.join(" ")).toMatch(/pandemic/);
    if (types.chart?.type !== "bar") throw new Error("expected a bar chart");
    const values = types.chart.bars.map((b) => b.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it("the home-health capacity signal never overclaims growth from a single snapshot", async () => {
    const insights = await marketGrowthAgent.run({ modelProvider: null });
    const capacitySignal = insights.find((i) => i.id.includes("home-health-capacity-signal"));
    expect(capacitySignal?.signalType).toBe("baseline");
    expect(capacitySignal?.confidence).toBe("low");
    expect(capacitySignal?.magnitude.unit).toBe("episodes-per-agency");
    // Must disclose that episodes-per-agency is a self-referential proxy, not real population data
    expect(capacitySignal?.limitations.join(" ")).toMatch(/population|eligible-beneficiary/i);
  });

  it("every insight carries real bar-chart data, not fabricated", async () => {
    const insights = await marketGrowthAgent.run({ modelProvider: null });
    for (const insight of insights) {
      expect(insight.chart?.type).toBe("bar");
      if (insight.chart?.type === "bar") {
        expect(insight.chart.bars.length).toBeGreaterThan(0);
        for (const bar of insight.chart.bars) {
          expect(typeof bar.label).toBe("string");
          expect(Number.isFinite(bar.value)).toBe(true);
        }
      }
    }
  });

  it("with a model configured, charts only real states the model picked, while headline claims still come from the full ranking", async () => {
    const baseline = await marketGrowthAgent.run({ modelProvider: null });
    const provider = bottomPickingProvider();
    const insights = await marketGrowthAgent.run({ modelProvider: provider });

    // Hospital beds, nursing home beds, home health; the facility-type chart shows every type, so it has no selection step.
    expect(provider.prompts).toHaveLength(3);
    expect(insights).toHaveLength(baseline.length);
    const salient = ["hospital-beds-by-state", "nursing-home-beds-by-state", "home-health-capacity-signal"];
    for (const [i, stem] of salient.entries()) {
      const insight = insights.find((x) => x.id.endsWith(stem))!;
      const before = baseline.find((x) => x.id.endsWith(stem))!;
      expect(() => validateInsight(insight)).not.toThrow();
      expect(insight.headline).toBe(before.headline);
      expect(insight.magnitude).toEqual(before.magnitude);
      if (insight.chart?.type !== "bar" || before.chart?.type !== "bar") throw new Error("expected bar charts");
      expect(insight.chart.bars.map((b) => b.label)).not.toEqual(before.chart.bars.map((b) => b.label));
      for (const bar of insight.chart.bars) expect(provider.prompts[i]).toContain(`id="${bar.label}"`);
      expect(insight.drivers[0].description).toContain(TEST_RATIONALE);
    }
    const types = (list: typeof insights) => list.find((x) => x.id.endsWith("facility-count-by-type"));
    expect(withoutGeneratedAt([types(insights)!])).toEqual(withoutGeneratedAt([types(baseline)!]));
  });

  it("falls back to its exact no-model output when the model invents a candidate", async () => {
    const baseline = await marketGrowthAgent.run({ modelProvider: null });
    const insights = await marketGrowthAgent.run({ modelProvider: inventingProvider() });
    expect(withoutGeneratedAt(insights)).toEqual(withoutGeneratedAt(baseline));
  });
});
