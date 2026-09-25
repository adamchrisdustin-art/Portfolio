import { describe, expect, it } from "vitest";
import type { ModelProvider } from "../../providers/types";
import { selectNoteworthy, type Candidate } from "./selectNoteworthy";

const CANDIDATES: Candidate[] = [
  { id: "AL", label: "Alabama", summary: "330 episodes/agency across 116 agencies", primaryMetric: 330 },
  { id: "TX", label: "Texas", summary: "210 episodes/agency across 400 agencies", primaryMetric: 210 },
  { id: "OH", label: "Ohio", summary: "195 episodes/agency, jumped from rank 15 last cycle", primaryMetric: 195 },
  { id: "CA", label: "California", summary: "180 episodes/agency across 500 agencies", primaryMetric: 180 },
];

function fakeProvider(response: string | null): ModelProvider {
  return { name: "fake:test", generate: async () => response };
}

describe("selectNoteworthy", () => {
  it("falls back to deterministic top-N ranking when no provider is configured", async () => {
    const result = await selectNoteworthy({ candidates: CANDIDATES, topN: 2, taskDescription: "test" }, { modelProvider: null });
    expect(result.source).toBe("deterministic");
    expect(result.selections.map((s) => s.candidateId)).toEqual(["AL", "TX"]); // highest primaryMetric first
  });

  it("falls back to deterministic ranking when candidates already fit within topN - no reasoning needed", async () => {
    const provider = fakeProvider('[{"candidateId":"AL","rationale":"x"}]');
    const result = await selectNoteworthy({ candidates: CANDIDATES.slice(0, 2), topN: 5, taskDescription: "test" }, { modelProvider: provider });
    expect(result.source).toBe("deterministic");
  });

  it("uses the model's real selection when it returns valid, well-formed JSON referencing only real candidate ids", async () => {
    const provider = fakeProvider(
      JSON.stringify([
        { candidateId: "OH", rationale: "Jumped from rank 15 last cycle, unlike the other stable top performers." },
        { candidateId: "AL", rationale: "Highest raw volume." },
      ])
    );
    const result = await selectNoteworthy({ candidates: CANDIDATES, topN: 2, taskDescription: "test" }, { modelProvider: provider });
    expect(result.source).toBe("llm");
    expect(result.selections.map((s) => s.candidateId)).toEqual(["OH", "AL"]);
    expect(result.selections[0].rationale).toContain("rank 15");
  });

  it("strips a markdown code fence if the model wraps its JSON in one", async () => {
    const provider = fakeProvider('```json\n[{"candidateId":"AL","rationale":"x"}]\n```');
    const result = await selectNoteworthy({ candidates: CANDIDATES, topN: 1, taskDescription: "test" }, { modelProvider: provider });
    expect(result.source).toBe("llm");
    expect(result.selections[0].candidateId).toBe("AL");
  });

  it("falls back to deterministic ranking when the model invents a candidate id that was never given to it", async () => {
    const provider = fakeProvider(JSON.stringify([{ candidateId: "FAKE-STATE-NOT-REAL", rationale: "invented" }]));
    const result = await selectNoteworthy({ candidates: CANDIDATES, topN: 2, taskDescription: "test" }, { modelProvider: provider });
    expect(result.source).toBe("deterministic");
  });

  it("falls back to deterministic ranking when a rationale cites a number the candidates don't contain", async () => {
    const provider = fakeProvider(JSON.stringify([{ candidateId: "OH", rationale: "Ohio grew 48% year over year." }]));
    const result = await selectNoteworthy({ candidates: CANDIDATES, topN: 2, taskDescription: "test" }, { modelProvider: provider });
    expect(result.source).toBe("deterministic");
  });

  it("falls back to deterministic ranking when a rationale names a carrier the candidates don't mention", async () => {
    const provider = fakeProvider(JSON.stringify([{ candidateId: "OH", rationale: "Humana dominates this market." }]));
    const result = await selectNoteworthy({ candidates: CANDIDATES, topN: 2, taskDescription: "test" }, { modelProvider: provider });
    expect(result.source).toBe("deterministic");
  });

  it("falls back to deterministic ranking on unparseable model output", async () => {
    const provider = fakeProvider("not json at all, just prose");
    const result = await selectNoteworthy({ candidates: CANDIDATES, topN: 2, taskDescription: "test" }, { modelProvider: provider });
    expect(result.source).toBe("deterministic");
  });

  it("falls back to deterministic ranking when the provider call fails", async () => {
    const provider: ModelProvider = {
      name: "fake:throws",
      generate: async () => {
        throw new Error("network error");
      },
    };
    const result = await selectNoteworthy({ candidates: CANDIDATES, topN: 2, taskDescription: "test" }, { modelProvider: provider });
    expect(result.source).toBe("deterministic");
  });

  it("falls back to deterministic ranking when the provider returns null", async () => {
    const result = await selectNoteworthy({ candidates: CANDIDATES, topN: 2, taskDescription: "test" }, { modelProvider: fakeProvider(null) });
    expect(result.source).toBe("deterministic");
  });
});
