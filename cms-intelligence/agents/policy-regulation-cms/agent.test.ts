import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { bottomPickingProvider, inventingProvider, TEST_RATIONALE, withoutGeneratedAt } from "../../intelligence/salience/testProviders";
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
    }
  });

  it("presents upcoming finalized rules as a linked list of real rule titles, not a bar chart keyed by opaque document numbers", async () => {
    const insights = await policyRegulationCmsAgent.run({ modelProvider: null });
    const upcoming = insights.find((i) => i.questionId === "Q076");
    expect(upcoming).toBeDefined();
    expect(upcoming?.chart?.type).toBe("list");
    if (upcoming?.chart?.type === "list") {
      expect(upcoming.chart.items.length).toBeGreaterThan(0);
      for (const item of upcoming.chart.items) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.url).toMatch(/^https:\/\//);
      }
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
    // Which domain a rule routes to (payment, providers, beneficiaries, utilization) isn't determined yet, and the finding says so.
    expect(finalized?.limitations.join(" ")).toMatch(/does not yet determine which domain/i);
  });

  it("ranks by recency/proximity with direction 'lowest' - the model is told fewer days is the noteworthy signal", async () => {
    const provider = bottomPickingProvider();
    await policyRegulationCmsAgent.run({ modelProvider: provider });
    expect(provider.prompts.length).toBeGreaterThan(0);
    for (const prompt of provider.prompts) expect(prompt).toMatch(/LOWER primary-metric value is the noteworthy signal/);
  });

  it("with a model configured, lists only real rules the model picked, while 'most recently'/'nearest' headline claims still come from the full sorted list", async () => {
    const baseline = await policyRegulationCmsAgent.run({ modelProvider: null });
    const provider = bottomPickingProvider();
    const insights = await policyRegulationCmsAgent.run({ modelProvider: provider });

    expect(insights).toHaveLength(baseline.length);
    for (const [i, insight] of insights.entries()) {
      expect(() => validateInsight(insight)).not.toThrow();
      expect(insight.headline).toBe(baseline[i].headline);
      expect(insight.magnitude).toEqual(baseline[i].magnitude);
    }

    const upcoming = insights.find((i) => i.questionId === "Q076");
    const upcomingBaseline = baseline.find((i) => i.questionId === "Q076");
    if (upcoming?.chart?.type !== "list" || upcomingBaseline?.chart?.type !== "list") throw new Error("expected list charts");
    if (provider.prompts.some((p) => p.includes("operational-readiness calendar"))) {
      expect(upcoming.chart.items.map((x) => x.url)).not.toEqual(upcomingBaseline.chart.items.map((x) => x.url));
      expect(upcoming.drivers[0].description).toContain(TEST_RATIONALE);
    }
    for (const item of upcoming.chart.items) expect(item.url).toMatch(/^https:\/\//);
  });

  it("falls back to its exact no-model output when the model invents a candidate", async () => {
    const baseline = await policyRegulationCmsAgent.run({ modelProvider: null });
    const insights = await policyRegulationCmsAgent.run({ modelProvider: inventingProvider() });
    expect(withoutGeneratedAt(insights)).toEqual(withoutGeneratedAt(baseline));
  });
});
