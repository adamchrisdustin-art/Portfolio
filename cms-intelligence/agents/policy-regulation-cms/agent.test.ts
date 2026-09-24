import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { policyRegulationCmsAgent } from "./agent";

/** Runs against the real Federal Register CMS-document snapshot already committed to this repo. */
describe("policyRegulationCmsAgent", () => {
  it("produces valid, evidence-backed insights from real Federal Register data", async () => {
    const insights = await policyRegulationCmsAgent.run({ modelProvider: null });
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(() => validateInsight(insight)).not.toThrow();
      expect(insight.sourceIds).toContain("federal-register:cms-documents");
      expect(insight.signalType).toBe("policy");
      expect(insight.chart?.type).toBe("bar");
    }
  });

  it("never presents a proposed rule as decided policy", async () => {
    const insights = await policyRegulationCmsAgent.run({ modelProvider: null });
    const proposed = insights.find((i) => i.questionId === "Q075");
    expect(proposed).toBeDefined();
    expect(proposed?.businessRelevance.toLowerCase()).toMatch(/not decided|not yet final|could still change/);
  });

  it("distinguishes finalized rules from routing judgments it hasn't made", async () => {
    const insights = await policyRegulationCmsAgent.run({ modelProvider: null });
    const finalized = insights.find((i) => i.questionId === "Q074");
    expect(finalized).toBeDefined();
    // Q077-Q080 (which domain a rule routes to) is explicitly the LLM step this agent hasn't run yet.
    expect(finalized?.limitations.join(" ")).toMatch(/routing|LLM/i);
  });
});
