import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { providerNetworkAgent } from "./agent";

describe("providerNetworkAgent", () => {
  it("produces a valid insight with real donut-chart data", async () => {
    const insights = await providerNetworkAgent.run({ modelProvider: null });
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(() => validateInsight(insight)).not.toThrow();
      expect(insight.chart?.type).toBe("donut");
      if (insight.chart?.type === "donut") {
        expect(insight.chart.slices.length).toBeGreaterThan(1);
        const total = insight.chart.slices.reduce((s, v) => s + v.value, 0);
        expect(total).toBeGreaterThan(0);
      }
    }
  });
});
