import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { commercialMarketplaceAgent } from "./agent";

/** Runs against the real CMS Marketplace Rate PUF snapshot already committed to this repo. */
describe("commercialMarketplaceAgent", () => {
  it("produces valid, evidence-backed insights from real Marketplace rate data with no model configured", async () => {
    const insights = await commercialMarketplaceAgent.run({ modelProvider: null });
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(() => validateInsight(insight)).not.toThrow();
      expect(insight.sourceIds).toContain("cms:marketplace-rate-puf");
      expect(insight.population).toBe("marketplace");
    }
  });

  it("never names a real carrier - only opaque plan/issuer IDs are counted, never surfaced, and state codes only", async () => {
    const insights = await commercialMarketplaceAgent.run({ modelProvider: null });
    const forbiddenNamePatterns = ["unitedhealthcare", "optum", "humana", "aetna", "cigna", "kaiser", "molina", "centene", "elevance", "anthem"].map(
      (n) => new RegExp(`\\b${n}\\b`, "i")
    );
    for (const insight of insights) {
      const text = JSON.stringify(insight);
      for (const pattern of forbiddenNamePatterns) expect(text).not.toMatch(pattern);
    }
  });

  it("the premium distribution insight uses a real boxplot with correctly ordered whiskers", async () => {
    const insights = await commercialMarketplaceAgent.run({ modelProvider: null });
    const premium = insights.find((i) => i.questionId === "Q067");
    expect(premium).toBeDefined();
    expect(premium?.chart?.type).toBe("boxplot");
    if (premium?.chart?.type === "boxplot") {
      for (const box of premium.chart.boxes) {
        expect(box.whiskerLow).toBeLessThanOrEqual(box.q1);
        expect(box.q3).toBeLessThanOrEqual(box.whiskerHigh);
      }
    }
    // Must disclose that $0/$9999 exclusion is an empirical judgment, not an official CMS convention
    expect(premium?.limitations.join(" ")).toMatch(/empirical judgment/i);
  });

  it("discloses that WA/CA/NY are structurally absent from this federal file", async () => {
    const insights = await commercialMarketplaceAgent.run({ modelProvider: null });
    for (const insight of insights) {
      expect(insight.limitations.join(" ")).toMatch(/State-Based Exchange|absent from this federal file/i);
    }
  });

  it("the plan-availability insight's chart shows real, non-tied per-state issuer counts, not a degenerate per-rating-area tie", async () => {
    const insights = await commercialMarketplaceAgent.run({ modelProvider: null });
    const availability = insights.find((i) => i.questionId === "Q071");
    expect(availability).toBeDefined();
    expect(availability?.chart?.type).toBe("bar");
    expect(availability?.geography.level).toBe("state");
    // Real bug this guards against: a rating-area-level version of this metric produced 9 South
    // Carolina rating areas tied at exactly 27 - a degenerate ranking with no real signal. The
    // state-level real IssuerId count must show genuine variation (no repeated values) instead.
    const fewestFromComparedTo = Number(availability?.magnitude.comparedTo?.match(/\((\d+)\)/)?.[1]);
    expect(Number.isNaN(fewestFromComparedTo)).toBe(false);
    if (availability?.chart?.type === "bar") {
      const values = availability.chart.bars.map((b) => b.value);
      for (const v of values) expect(v).toBeGreaterThan(0);
      expect(values.some((v) => v === fewestFromComparedTo)).toBe(true);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});
