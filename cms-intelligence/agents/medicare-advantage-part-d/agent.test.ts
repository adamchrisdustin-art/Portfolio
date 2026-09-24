import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { medicareAdvantagePartDAgent } from "./agent";

/** Runs against the real CMS Monthly Enrollment by Plan snapshot already committed to this repo. */
describe("medicareAdvantagePartDAgent", () => {
  it("produces valid, evidence-backed insights from real MA/Part D enrollment data with no model configured", async () => {
    const insights = await medicareAdvantagePartDAgent.run({ modelProvider: null });
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(() => validateInsight(insight)).not.toThrow();
      expect(insight.sourceIds).toContain("cms:ma-part-d-enrollment");
      expect(insight.population === "medicare-advantage" || insight.population === "part-d").toBe(true);
    }
  });

  it("never names a real carrier/organization/plan - only category fields", async () => {
    const insights = await medicareAdvantagePartDAgent.run({ modelProvider: null });
    // Word-boundary matching, not plain substring - "elevance" is a real carrier name but also a substring of "relevance", which every insight's businessRelevance field legitimately contains.
    const forbiddenNamePatterns = ["unitedhealthcare", "optum", "humana", "aetna", "cvs", "kaiser", "cigna", "elevance"].map(
      (name) => new RegExp(`\\b${name}\\b`, "i")
    );
    for (const insight of insights) {
      const text = JSON.stringify(insight);
      for (const pattern of forbiddenNamePatterns) {
        expect(text).not.toMatch(pattern);
      }
    }
  });

  it("the plan-type mix insight's headline always names the true largest-by-enrollment plan type, regardless of salience selection order", async () => {
    const insights = await medicareAdvantagePartDAgent.run({ modelProvider: null });
    const mix = insights.find((i) => i.questionId === "Q049");
    expect(mix).toBeDefined();
    // "Medicare Prescription Drug Plan" is the real dominant PLAN TYPE in this repo's committed snapshot (distinct from "Local CCP", which is the dominant ORGANIZATION type - a different real dimension in the same data).
    expect(mix?.headline).toContain("Medicare Prescription Drug Plan");
    expect(mix?.chart?.type).toBe("bar");
  });

  it("the Part D attachment insight sums to a real, sane percentage", async () => {
    const insights = await medicareAdvantagePartDAgent.run({ modelProvider: null });
    const attachment = insights.find((i) => i.questionId === "Q053");
    expect(attachment).toBeDefined();
    expect(attachment?.magnitude.unit).toBe("percent");
    expect(attachment?.magnitude.value).toBeGreaterThan(0);
    expect(attachment?.magnitude.value).toBeLessThanOrEqual(100);
    expect(attachment?.chart?.type).toBe("donut");
  });

  it("discloses real CMS suppression - excludes rows CMS itself marked '*' rather than imputing a value", async () => {
    const insights = await medicareAdvantagePartDAgent.run({ modelProvider: null });
    const mix = insights.find((i) => i.questionId === "Q049");
    expect(mix?.limitations.join(" ")).toMatch(/suppressed/i);
  });
});
