import { describe, expect, it } from "vitest";
import { ALL_AGENTS } from "./registry";
import { ORCHESTRATOR, SPECIALISTS } from "./teamRoster";

describe("team roster", () => {
  it("lists exactly the agents the sweep runs, so the page can't drift from the code", () => {
    expect(SPECIALISTS.map((m) => m.agentId).sort()).toEqual(ALL_AGENTS.map((a) => a.id).sort());
  });

  it("names no insurer or carrier", () => {
    const text = JSON.stringify([ORCHESTRATOR, ...SPECIALISTS]);
    for (const name of ["unitedhealth", "optum", "humana", "aetna", "cigna", "kaiser", "centene", "elevance", "cvs"]) {
      expect(text.toLowerCase()).not.toContain(name);
    }
  });
});
