import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { marketGrowthAgent } from "./agent";

/** Runs against real committed data: Hospital General Information + Home Health Care Agencies. */
describe("marketGrowthAgent", () => {
  it("returns both the hospital-distribution insight and the home-health capacity signal", async () => {
    const insights = await marketGrowthAgent.run({ modelProvider: null });
    expect(insights.length).toBeGreaterThanOrEqual(2);

    const capacitySignal = insights.find((i) => i.id.includes("home-health-capacity-signal"));
    expect(capacitySignal).toBeDefined();
    for (const insight of insights) {
      expect(() => validateInsight(insight)).not.toThrow();
    }
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

  it("both insights carry real bar-chart data, not fabricated", async () => {
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
});
