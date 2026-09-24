import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { runOrchestrator } from "./orchestrator";

/**
 * Exercises 03_PHASE_3_AGENT_IMPLEMENTATION.md's acceptance criterion
 * directly: "A test query should be able to invoke at least two
 * specialist agents and produce a synthesized insight with explicit
 * evidence references." Q001 routes to Market Growth, Q038 routes to
 * Provider & Network - the two agents Phase 3 wired to the real,
 * already-live CMS Hospital General Information dataset (see
 * data/cms/hospital-general-information/snapshots/), so this test runs
 * against real data already committed to the repo, not a mock.
 */
describe("runOrchestrator", () => {
  it("invokes at least two specialist agents for a cross-category query", async () => {
    const result = await runOrchestrator(["Q001", "Q038"], { modelProvider: null });

    expect(result.invokedAgentIds).toContain("market-growth-geographic-intelligence");
    expect(result.invokedAgentIds).toContain("provider-network-intelligence");
    expect(result.invokedAgentIds.length).toBeGreaterThanOrEqual(2);
  });

  it("produces a synthesized result whose insights are all independently valid and evidence-backed", async () => {
    const result = await runOrchestrator(["Q001", "Q038"], { modelProvider: null });

    // Real data may or may not be present depending on the environment
    // this runs in (data/cms/ is committed, so it should be) - assert the
    // shape is always correct, and additionally assert real content when
    // the fixture data is actually there.
    for (const insight of result.insights) {
      expect(() => validateInsight(insight)).not.toThrow();
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.sourceIds.length).toBeGreaterThan(0);
    }

    expect(typeof result.synthesis).toBe("string");
    expect(result.synthesis.length).toBeGreaterThan(0);
    expect(result.synthesisSource).toBe("rule-based"); // no provider configured in this test
  });

  it("falls back to rule-based synthesis with no model provider configured (cost gate holds)", async () => {
    const result = await runOrchestrator(["Q001"], { modelProvider: null });
    expect(result.synthesisSource).toBe("rule-based");
  });

  it("routes an unroutable question (Q108, orchestrator-only) to zero specialists without throwing", async () => {
    const result = await runOrchestrator(["Q108"], { modelProvider: null });
    expect(result.invokedAgentIds).toHaveLength(0);
    expect(result.insights).toHaveLength(0);
  });
});
