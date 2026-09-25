import { describe, expect, it } from "vitest";
import type { ModelProvider } from "../../providers/types";
import { runFullSweep } from "./fullSweep";
import { synthesize } from "./synthesis";

function fakeProvider(text: string): ModelProvider {
  return { name: "fake:synthesis", generate: async () => text };
}

describe("synthesize", () => {
  it("uses the model's narrative when every number and name in it traces to the insights", async () => {
    const { allInsights } = await runFullSweep();
    const result = await synthesize(allInsights, "test", { modelProvider: fakeProvider("Several real signals stand out; most are baselines.") });
    expect(result.synthesisSource).toBe("llm");
  });

  it("falls back to the rule-based narrative when the model cites a number the insights don't contain", async () => {
    const { allInsights } = await runFullSweep();
    const result = await synthesize(allInsights, "test", { modelProvider: fakeProvider("Costs jumped 987654% this year.") });
    expect(result.synthesisSource).toBe("rule-based");
    expect(result.synthesis).not.toMatch(/987654/);
  });
});
