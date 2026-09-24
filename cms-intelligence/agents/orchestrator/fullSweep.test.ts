import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { runFullSweep } from "./fullSweep";

describe("runFullSweep", () => {
  it("runs all 11 agents and reports a status for each, never throwing", async () => {
    const result = await runFullSweep();
    expect(result.agentStatuses).toHaveLength(11);
    expect(result.agentStatuses.every((s) => s.ok)).toBe(true);
  });

  it("groups real insights into their correct dashboard layer", async () => {
    const result = await runFullSweep();
    // Market Growth (Q001) -> market-growth layer
    expect(result.insightsByLayer["market-growth"].some((i) => i.questionId === "Q001")).toBe(true);
    // Provider & Network (Q038) -> provider-network layer
    expect(result.insightsByLayer["provider-network"].some((i) => i.questionId === "Q038")).toBe(true);
    // Claims/Utilization/Cost (Q012) -> claims-cost layer
    expect(result.insightsByLayer["claims-cost"].some((i) => i.questionId === "Q012")).toBe(true);
  });

  it("every returned insight is independently valid", async () => {
    const result = await runFullSweep();
    for (const insight of result.allInsights) {
      expect(() => validateInsight(insight)).not.toThrow();
    }
  });
});
