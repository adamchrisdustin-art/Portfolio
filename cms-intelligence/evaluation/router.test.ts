import { describe, expect, it } from "vitest";
import { BENCHMARK_SUITE } from "./benchmarkSuite";
import { recommendTier, TIER_PROVIDER_DEFAULTS } from "./router";

describe("recommendTier", () => {
  it("covers every task category in the real benchmark suite", () => {
    for (const task of BENCHMARK_SUITE) {
      expect(() => recommendTier(task.category)).not.toThrow();
      expect(recommendTier(task.category)).toBeDefined();
    }
  });

  it("routes executive synthesis and evidence reconciliation to the strong tier, not by prestige but per the phase doc's explicit categorization", () => {
    expect(recommendTier("executive-synthesis")).toBe("strong");
    expect(recommendTier("evidence-reconciliation")).toBe("strong");
  });

  it("routes categories this repo's real agents already compute deterministically to the deterministic tier", () => {
    expect(recommendTier("reimbursement-change")).toBe("deterministic");
    expect(recommendTier("provider-concentration")).toBe("deterministic");
  });

  it("every non-deterministic tier has both an Anthropic and an OpenAI default", () => {
    expect(TIER_PROVIDER_DEFAULTS.efficient.anthropic).toMatch(/^anthropic:/);
    expect(TIER_PROVIDER_DEFAULTS.efficient.openai).toMatch(/^openai:/);
    expect(TIER_PROVIDER_DEFAULTS.strong.anthropic).toMatch(/^anthropic:/);
    expect(TIER_PROVIDER_DEFAULTS.strong.openai).toMatch(/^openai:/);
  });
});
