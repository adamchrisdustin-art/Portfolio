import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { loadAllMonths } from "../../data/adapters/maPartDHistory";
import { medicareAdvantagePartDAgent } from "./agent";

/** Runs against the real CMS Monthly Enrollment by Plan snapshot and monthly history already committed to this repo. */
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

  it("the plan-type mix and Part D attachment insights never name a real carrier - category fields only", async () => {
    const insights = await medicareAdvantagePartDAgent.run({ modelProvider: null });
    // Word-boundary matching, not plain substring - "elevance" is a real carrier name but also a substring of "relevance", which every insight's businessRelevance field legitimately contains.
    const forbiddenNamePatterns = ["unitedhealthcare", "optum", "humana", "aetna", "cvs", "kaiser", "cigna", "elevance"].map(
      (name) => new RegExp(`\\b${name}\\b`, "i")
    );
    const categoryOnlyInsights = insights.filter((i) => i.questionId === "Q049" || i.questionId === "Q053");
    expect(categoryOnlyInsights.length).toBeGreaterThan(0);
    for (const insight of categoryOnlyInsights) {
      const text = JSON.stringify(insight);
      for (const pattern of forbiddenNamePatterns) {
        expect(text).not.toMatch(pattern);
      }
    }
  });

  it("the parent-organization ranking names a real carrier as a genuine, sourced finding, not a fabricated claim", async () => {
    const insights = await medicareAdvantagePartDAgent.run({ modelProvider: null });
    const ranking = insights.find((i) => i.questionId === "Q046");
    expect(ranking).toBeDefined();
    // UnitedHealth Group is the real, verified #1 by enrollment in this repo's committed snapshot - matches the
    // kind of ranking a real industry directory (e.g. AIS Health) publishes from this same public CMS data.
    expect(ranking?.headline).toContain("UnitedHealth Group");
    expect(ranking?.chart?.type).toBe("bar");
    expect(ranking?.limitations.join(" ")).toMatch(/not this project's own claim/i);
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

  it("reports year-over-year MA change from the monthly history, comparing the same calendar month and keeping PDP separate", async () => {
    const insights = await medicareAdvantagePartDAgent.run({ modelProvider: null });
    const trend = insights.find((i) => i.id.endsWith("ma-enrollment-trend"))!;
    expect(trend.headline).toMatch(/Medicare Advantage enrollment reached [\d.]+M in (\d{4})-(\d{2}), [+-][\d.]+% year over year/);
    expect(trend.headline).toMatch(/standalone Part D plans/);
    // One point per real monthly file, never interpolated
    expect(trend.series?.points.length).toBe(loadAllMonths().length);
  });

  it("measures parent-organization share shifts on MA enrollment alone, and names only organizations in the real data", async () => {
    const insights = await medicareAdvantagePartDAgent.run({ modelProvider: null });
    const shift = insights.find((i) => i.id.endsWith("ma-share-shift"))!;
    expect(() => validateInsight(shift)).not.toThrow();
    const names = new Set(loadAllMonths().flatMap((m) => m.byParentOrganization.map((p) => p.parentOrganization)));
    if (shift.chart?.type !== "bar") throw new Error("expected a bar chart");
    for (const bar of shift.chart.bars) expect(names.has(bar.label)).toBe(true);
    expect(insights.find((i) => i.id.endsWith("ma-plan-type-shift"))?.questionId).toBe("Q049");
  });
});
