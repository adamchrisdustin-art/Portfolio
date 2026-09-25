import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { emergingTrendsAgent } from "./agent";

/**
 * Runs against real data from TWO independent sources already committed
 * to this repo (Hospital General Information + Medicare Physician &
 * Other Practitioners full-population summary) - the "agents working together"
 * cross-reference.
 */
describe("emergingTrendsAgent", () => {
  it("produces a valid, evidence-backed cross-dataset insight citing two independent sources", async () => {
    const insights = await emergingTrendsAgent.run({ modelProvider: null });
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(() => validateInsight(insight)).not.toThrow();
      expect(insight.sourceIds).toContain("cms:hospital-general-information");
      expect(insight.sourceIds).toContain("cms:medicare-physician-by-provider");
      // Every state, not the old 5-state sample
      expect(insight.chart?.type === "scatter" && insight.chart.points.length).toBeGreaterThan(40);
      expect(insight.evidence.length).toBeGreaterThanOrEqual(2);
      // Must never overclaim causation from a correlation
      expect(insight.drivers.every((d) => d.relationship !== "confirmed-causal")).toBe(true);
    }
  });
});
