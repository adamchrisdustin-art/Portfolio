import { describe, expect, it } from "vitest";
import { estimateAllConfiguredCosts, estimateCost, getPricing, projectAnnualCostUsd } from "./costModel";

describe("costModel", () => {
  it("every configured model has real, positive pricing with a verification source", () => {
    const estimates = estimateAllConfiguredCosts();
    expect(estimates.length).toBeGreaterThanOrEqual(2);
    for (const estimate of estimates) {
      const pricing = getPricing(estimate.providerName);
      expect(pricing).toBeDefined();
      expect(pricing!.inputPerMillionUsd).toBeGreaterThan(0);
      expect(pricing!.outputPerMillionUsd).toBeGreaterThan(0);
      expect(pricing!.verifiedVia.length).toBeGreaterThan(0);
      expect(estimate.costPerQuestionUsd).toBeGreaterThan(0);
      expect(estimate.assumptions.length).toBeGreaterThan(0);
    }
  });

  it("cheaper providers produce a cheaper per-question estimate", () => {
    const haiku = estimateCost("anthropic:claude-haiku-4-5-20251001")!;
    const opus = estimateCost("anthropic:claude-opus-5-5")!;
    const gptMini = estimateCost("openai:gpt-4o-mini")!;
    expect(haiku.costPerQuestionUsd).toBeLessThan(opus.costPerQuestionUsd);
    expect(gptMini.costPerQuestionUsd).toBeLessThan(haiku.costPerQuestionUsd);
  });

  it("an unknown provider name returns null rather than a fabricated estimate", () => {
    expect(estimateCost("made-up-provider:v1")).toBeNull();
  });

  it("annual projection scales linearly with runs per year", () => {
    const oneRun = projectAnnualCostUsd("openai:gpt-4o-mini", 1)!;
    const fourRuns = projectAnnualCostUsd("openai:gpt-4o-mini", 4)!;
    expect(fourRuns).toBeCloseTo(oneRun * 4, 6);
  });

  it("every estimate stays well under a dollar per run at current real prices, confirming the $100 credit is not a binding constraint for this system's actual LLM footprint", () => {
    for (const estimate of estimateAllConfiguredCosts()) {
      expect(estimate.costPerDashboardRefreshUsd).toBeLessThan(1);
    }
  });
});
