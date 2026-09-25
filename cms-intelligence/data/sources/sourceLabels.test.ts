import { describe, expect, it } from "vitest";
import { runFullSweep } from "../../agents/orchestrator/fullSweep";
import { SOURCE_LABELS } from "./sourceLabels";

describe("source labels", () => {
  it("names every source an agent cited this sweep", async () => {
    const sweep = await runFullSweep();
    const cited = new Set(sweep.allInsights.flatMap((i) => i.sourceIds));
    expect(cited.size).toBeGreaterThan(0);
    for (const id of cited) expect(SOURCE_LABELS[id], `add a label for ${id}`).toBeDefined();
  });
});
