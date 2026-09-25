import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { loadAllPlanYears } from "../../data/adapters/marketplaceRatePuf";
import { commercialMarketplaceAgent } from "./agent";

/** Runs against the real CMS Marketplace plan-year summaries committed to this repo. */
describe("commercialMarketplaceAgent", () => {
  it("produces benchmark, state, deductible and issuer insights from every plan year", async () => {
    const insights = await commercialMarketplaceAgent.run({ modelProvider: null });
    expect(insights.map((i) => i.id.replace(/^sig-marketplace-\d{4}-/, "")).sort()).toEqual(["benchmark-by-state", "benchmark-trend", "deductible-trend", "issuer-participation"]);
    for (const insight of insights) {
      expect(() => validateInsight(insight)).not.toThrow();
      expect(insight.sourceIds).toContain("cms:marketplace-rate-puf");
      expect(insight.population).toBe("marketplace");
      // Every insight must say which states the federal files leave out
      expect(insight.limitations.join(" ")).toMatch(/HealthCare\.gov states only/);
    }
    const trend = insights.find((i) => i.id.endsWith("benchmark-trend"))!;
    expect(trend.series?.points.length).toBe(loadAllPlanYears().length);
  });

  it("never names a carrier - issuers are counted by id only", async () => {
    const insights = await commercialMarketplaceAgent.run({ modelProvider: null });
    const forbidden = ["unitedhealthcare", "optum", "humana", "aetna", "cigna", "kaiser", "molina", "centene", "ambetter", "elevance", "anthem", "oscar"].map(
      (n) => new RegExp(`\\b${n}\\b`, "i")
    );
    for (const insight of insights) {
      const text = JSON.stringify(insight);
      for (const pattern of forbidden) expect(text).not.toMatch(pattern);
    }
  });

  it("reports premiums at medical-plan levels, not the dental premiums the old sample mixed in", async () => {
    const insights = await commercialMarketplaceAgent.run({ modelProvider: null });
    const trend = insights.find((i) => i.id.endsWith("benchmark-trend"))!;
    for (const p of trend.series!.points) expect(p.value).toBeGreaterThan(150);
  });

  it("the issuer chart lists states fewest-first with real counts", async () => {
    const insights = await commercialMarketplaceAgent.run({ modelProvider: null });
    const issuers = insights.find((i) => i.id.endsWith("issuer-participation"))!;
    if (issuers.chart?.type !== "bar") throw new Error("expected a bar chart");
    const values = issuers.chart.bars.map((b) => b.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    for (const v of values) expect(v).toBeGreaterThan(0);
  });
});
