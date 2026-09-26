import { describe, expect, it } from "vitest";
import type { Insight } from "../intelligence/evidence/schema";
import { leadFindings } from "./leadFindings";

const make = (id: string, agent: string, signalType: string, confidence: string, questionId = "Q012", recency = "current"): Insight =>
  ({ id, generatingAgent: agent, signalType, confidence, questionId, freshness: { recency, isStale: recency === "stale" } }) as unknown as Insight;

describe("leadFindings", () => {
  it("leads with higher confidence, then trend over anomaly over structural change", () => {
    const picked = leadFindings([
      make("structural-low", "a", "structural-change", "low"),
      make("anomaly-med", "b", "anomaly", "medium"),
      make("trend-med", "c", "trend", "medium"),
      make("trend-low", "d", "trend", "low"),
    ]);
    expect(picked.map((i) => i.id)).toEqual(["trend-med", "anomaly-med", "trend-low", "structural-low"]);
  });

  it("skips baselines, stale data and the Market Catalysts log", () => {
    const picked = leadFindings([
      make("baseline", "a", "baseline", "medium"),
      make("stale", "b", "trend", "medium", "Q012", "stale"),
      make("catalyst", "c", "structural-change", "medium", "Q120"),
      make("kept", "d", "policy", "low", "Q074"),
    ]);
    expect(picked.map((i) => i.id)).toEqual(["kept"]);
  });

  it("takes at most 2 per agent and stops at the limit", () => {
    const many = ["1", "2", "3"].map((n) => make(`a${n}`, "a", "trend", "medium"));
    expect(leadFindings(many).map((i) => i.id)).toEqual(["a1", "a2"]);
    const spread = ["a", "b", "c", "d"].map((agent) => make(agent, agent, "trend", "medium"));
    expect(leadFindings(spread, 3)).toHaveLength(3);
  });
});
