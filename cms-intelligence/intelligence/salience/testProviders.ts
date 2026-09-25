/**
 * Fake model providers for exercising agents' salience paths in tests
 * without a real API call. Not imported by any production code.
 */
import type { Insight } from "../evidence/schema";
import type { ModelProvider } from "../../providers/types";

export const TEST_RATIONALE = "Test rationale: picked from the bottom of the candidate list.";

/**
 * Picks the LAST N real candidate ids from each prompt it's given - the
 * opposite end from the deterministic fallback, so a test can tell the
 * two paths apart. Records every candidate list it was shown.
 */
export function bottomPickingProvider(): ModelProvider & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    name: "fake:bottom-picker",
    prompts,
    generate: async ({ user }) => {
      prompts.push(user);
      const ids = Array.from(user.matchAll(/id="([^"]+)"/g), (m) => m[1]);
      const topN = Number(user.match(/select the (\d+) most noteworthy/)?.[1] ?? 1);
      return JSON.stringify(ids.slice(-topN).map((candidateId) => ({ candidateId, rationale: TEST_RATIONALE })));
    },
  };
}

/** Always answers with a candidate id that was never offered - selectNoteworthy must reject it and fall back. */
export function inventingProvider(): ModelProvider {
  return {
    name: "fake:inventor",
    generate: async () => JSON.stringify([{ candidateId: "NOT-A-REAL-CANDIDATE", rationale: "invented" }]),
  };
}

/** Strips the one field that legitimately differs between two runs (wall-clock generation time). */
export function withoutGeneratedAt(insights: Insight[]): unknown[] {
  return insights.map((i) => ({ ...i, freshness: { ...i.freshness, generatedAt: "" } }));
}
