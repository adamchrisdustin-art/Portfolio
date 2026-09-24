import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
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
});
