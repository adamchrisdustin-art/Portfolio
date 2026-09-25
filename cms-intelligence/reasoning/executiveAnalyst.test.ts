import { beforeAll, describe, expect, it } from "vitest";
import { runFullSweep } from "../agents/orchestrator/fullSweep";
import type { Insight } from "../intelligence/evidence/schema";
import type { ModelProvider } from "../providers/types";
import { runExecutiveAnalyst } from "./executiveAnalyst";

function fakeProvider(respond: (user: string) => string | null): ModelProvider & { calls: number } {
  const provider = {
    name: "fake:analyst",
    calls: 0,
    generate: async ({ user }: { user: string }) => {
      provider.calls++;
      return respond(user);
    },
  };
  return provider;
}

/** Real insights from the committed data - the same facts a live run reasons over. */
let insights: Insight[];
beforeAll(async () => {
  insights = (await runFullSweep()).allInsights;
});

function twoFromDifferentAgents(): [Insight, Insight] {
  const first = insights[0];
  const second = insights.find((i) => i.generatingAgent !== first.generatingAgent)!;
  return [first, second];
}

describe("runExecutiveAnalyst", () => {
  it("makes no model call and returns nothing when no provider is configured", async () => {
    const result = await runExecutiveAnalyst(insights, [], null);
    expect(result.source).toBe("none");
    expect(result.topFindings).toEqual([]);
  });

  it("keeps grounded findings, patterns and briefing that reference real insight ids", async () => {
    const [a, b] = twoFromDifferentAgents();
    const provider = fakeProvider(() =>
      JSON.stringify({
        topFindings: [{ insightId: a.id, whyItMatters: "Worth a leader's attention because it frames network strategy." }],
        patterns: [{ insightIds: [a.id, b.id], pattern: "These two readings point the same direction across domains." }],
        briefing: "Two real signals stand out this cycle; both are baselines, not yet trends.",
      })
    );
    const result = await runExecutiveAnalyst(insights, [], provider);
    expect(provider.calls).toBe(1);
    expect(result.source).toBe("llm");
    expect(result.topFindings.map((f) => f.insightId)).toEqual([a.id]);
    expect(result.patterns).toHaveLength(1);
    expect(result.briefing).toMatch(/Two real signals/);
    expect(result.rejected).toEqual([]);
  });

  it("drops a finding that references an insight id it was never given", async () => {
    const provider = fakeProvider(() =>
      JSON.stringify({ topFindings: [{ insightId: "sig-invented-by-model", whyItMatters: "Invented." }], patterns: [], briefing: "" })
    );
    const result = await runExecutiveAnalyst(insights, [], provider);
    expect(result.topFindings).toEqual([]);
    expect(result.rejected[0]).toMatchObject({ kind: "finding" });
    expect(result.rejected[0].reason).toMatch(/unknown insight id/);
  });

  it("drops text containing a number that isn't in the facts", async () => {
    const [a] = twoFromDifferentAgents();
    const provider = fakeProvider(() =>
      JSON.stringify({
        topFindings: [{ insightId: a.id, whyItMatters: "Utilization jumped 987654% this quarter." }],
        patterns: [],
        briefing: "Spending is up 987654% year over year.",
      })
    );
    const result = await runExecutiveAnalyst(insights, [], provider);
    expect(result.topFindings).toEqual([]);
    expect(result.briefing).toBeNull();
    expect(result.rejected.map((r) => r.kind).sort()).toEqual(["briefing", "finding"]);
    expect(result.rejected[0].reason).toMatch(/987654%/);
  });

  it("drops text naming a carrier the facts never mention", async () => {
    const [a] = twoFromDifferentAgents();
    const provider = fakeProvider(() =>
      JSON.stringify({ topFindings: [{ insightId: a.id, whyItMatters: "Kaiser is likely exposed to this." }], patterns: [], briefing: "" })
    );
    const result = await runExecutiveAnalyst(insights, [], provider);
    expect(result.topFindings).toEqual([]);
    expect(result.rejected[0].reason).toMatch(/Kaiser/);
  });

  it("rejects a 'pattern' that only links insights from a single agent", async () => {
    const a = insights[0];
    const sameAgent = insights.find((i) => i.id !== a.id && i.generatingAgent === a.generatingAgent)!;
    const provider = fakeProvider(() =>
      JSON.stringify({ topFindings: [], patterns: [{ insightIds: [a.id, sameAgent.id], pattern: "Same agent twice." }], briefing: "" })
    );
    const result = await runExecutiveAnalyst(insights, [], provider);
    expect(result.patterns).toEqual([]);
    expect(result.rejected[0].reason).toMatch(/two different agents/);
  });

  it("tags insights from sources with new data as newThisCycle in what the model sees", async () => {
    let prompt = "";
    const provider = fakeProvider((user) => {
      prompt = user;
      return "{}";
    });
    await runExecutiveAnalyst(insights, ["cms:marketplace-rate-puf"], provider);
    const factsJson = prompt.slice(prompt.indexOf("Facts (JSON):\n") + "Facts (JSON):\n".length, prompt.indexOf("\n\nPeriod comparisons (JSON):"));
    const facts = JSON.parse(factsJson) as { agent: string; newThisCycle: boolean }[];
    expect(facts.some((f) => f.newThisCycle)).toBe(true);
    expect(facts.filter((f) => f.newThisCycle).every((f) => f.agent === "commercial-marketplace-intelligence")).toBe(true);
  });

  it("returns nothing, rather than throwing, when the model's response isn't JSON", async () => {
    const result = await runExecutiveAnalyst(insights, [], fakeProvider(() => "Here is my analysis in prose."));
    expect(result.source).toBe("none");
    expect(result.note).toMatch(/not a JSON object/);
  });
});

describe("runExecutiveAnalyst with period comparisons", () => {
  const periodFacts = [
    {
      metric: "Phase 3 trial results first posted on ClinicalTrials.gov",
      sourceId: "clinicaltrials-gov:phase3-results",
      seasonal: false,
      comparisons: [
        {
          view: "year-over-year" as const,
          current: { period: "2026-H1", count: 270 },
          prior: { period: "2025-H1", count: 349 },
          change: -79,
          percentChange: -22.6,
          notable: true,
          basis: "the change of 79 is beyond 2 standard deviations of chance variation (49.8)",
        },
      ],
    },
  ];

  it("gives the model the comparisons and accepts text citing their numbers", async () => {
    const [a] = twoFromDifferentAgents();
    const provider = fakeProvider((user) => {
      expect(user).toContain("Period comparisons (JSON):");
      expect(user).toContain('"2025-H1"');
      return JSON.stringify({
        topFindings: [{ insightId: a.id, whyItMatters: "Phase 3 results postings fell 22.6% year-over-year, 270 in 2026-H1 against 349 in 2025-H1." }],
        patterns: [],
        briefing: "Phase 3 results postings fell 22.6% year-over-year in the first half.",
      });
    });
    const result = await runExecutiveAnalyst(insights, [], provider, periodFacts);
    expect(result.rejected).toEqual([]);
    expect(result.topFindings).toHaveLength(1);
    expect(result.briefing).toMatch(/22.6%/);
  });

  it("still rejects a period number the code never computed", async () => {
    const provider = fakeProvider(() =>
      JSON.stringify({ topFindings: [], patterns: [], briefing: "Phase 3 results postings fell 912.7% year-over-year in the first half." })
    );
    const result = await runExecutiveAnalyst(insights, [], provider, periodFacts);
    expect(result.briefing).toBeNull();
    expect(result.rejected[0].reason).toMatch(/912.7/);
  });
});
