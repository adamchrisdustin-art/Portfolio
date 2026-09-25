import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { bottomPickingProvider, inventingProvider, TEST_RATIONALE, withoutGeneratedAt } from "../../intelligence/salience/testProviders";
import { reimbursementPaymentAgent } from "./agent";

/** Runs against the real CMS Medicare Physician & Other Practitioners sample already committed to this repo. */
describe("reimbursementPaymentAgent", () => {
  it("produces a valid, evidence-backed insight from real claims-vs-payment data", async () => {
    const insights = await reimbursementPaymentAgent.run({ modelProvider: null });
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(() => validateInsight(insight)).not.toThrow();
      expect(insight.magnitude.unit).toBe("percent");
      expect(insight.sourceIds).toContain("cms:medicare-physician-other-practitioners");
      // Never claim this is the full national dataset
      expect(insight.limitations.join(" ")).toMatch(/5 states|not the full national/i);
      expect(insight.chart?.type).toBe("bar");
    }
  });

  it("with a model configured, charts only real candidates the model picked, while the 'largest volume' claim still comes from the full real ranking", async () => {
    const [baseline] = await reimbursementPaymentAgent.run({ modelProvider: null });
    const provider = bottomPickingProvider();
    const [insight] = await reimbursementPaymentAgent.run({ modelProvider: provider });

    expect(provider.prompts).toHaveLength(1);
    expect(() => validateInsight(insight)).not.toThrow();
    if (insight.chart?.type !== "bar" || baseline.chart?.type !== "bar") throw new Error("expected bar charts");
    const labels = insight.chart.bars.map((b) => b.label);
    expect(labels).not.toEqual(baseline.chart.bars.map((b) => b.label));
    for (const label of labels) expect(provider.prompts[0]).toContain(`id="${label}"`);

    expect(insight.headline).toMatch(/selected as most noteworthy/);
    expect(insight.headline.split("—")[1]).toBe(baseline.headline.split("—")[1]);
    expect(insight.magnitude).toEqual(baseline.magnitude);
    expect(insight.drivers[0].description).toContain(TEST_RATIONALE);
  });

  it("falls back to its exact no-model output when the model invents a candidate", async () => {
    const baseline = await reimbursementPaymentAgent.run({ modelProvider: null });
    const insights = await reimbursementPaymentAgent.run({ modelProvider: inventingProvider() });
    expect(withoutGeneratedAt(insights)).toEqual(withoutGeneratedAt(baseline));
  });
});
