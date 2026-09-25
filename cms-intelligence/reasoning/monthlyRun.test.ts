import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bottomPickingProvider } from "../intelligence/salience/testProviders";
import type { ModelProvider } from "../providers/types";
import { currentReasonedRun, loadLatestReasonedRun, runMonthlyReasoning } from "./monthlyRun";

/** Picks the first two real insight ids (from different agents) out of the facts it's shown. */
function fakeAnalyst(): ModelProvider & { calls: number } {
  const provider = {
    name: "fake:analyst",
    calls: 0,
    generate: async ({ user }: { user: string }) => {
      provider.calls++;
      const facts = JSON.parse(user.slice(user.indexOf("Facts (JSON):\n") + 14, user.indexOf("\n\nRespond with"))) as { id: string; agent: string }[];
      const a = facts[0];
      const b = facts.find((f) => f.agent !== a.agent)!;
      return JSON.stringify({
        topFindings: [{ insightId: a.id, whyItMatters: "Frames where leadership attention belongs." }],
        patterns: [{ insightIds: [a.id, b.id], pattern: "Two domains point the same way." }],
        briefing: "A grounded test briefing.",
      });
    },
  };
  return provider;
}

let outDir: string;
beforeEach(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "reasoned-"));
});
afterEach(() => {
  fs.rmSync(outDir, { recursive: true, force: true });
});

describe("runMonthlyReasoning", () => {
  it("does nothing and spends nothing without an analyst provider", async () => {
    expect(await runMonthlyReasoning({ salience: null, analyst: null, outDir })).toEqual({ status: "skipped-no-provider" });
    expect(fs.readdirSync(outDir)).toEqual([]);
  });

  it("writes a reasoned run over the real committed data, with model salience and grounded analyst output", async () => {
    const salience = bottomPickingProvider();
    const analyst = fakeAnalyst();
    const outcome = await runMonthlyReasoning({ salience, analyst, outDir });

    expect(outcome.status).toBe("written");
    expect(salience.prompts.length).toBeGreaterThan(0);
    expect(analyst.calls).toBe(1);
    const run = loadLatestReasonedRun(outDir)!;
    expect(run.models).toEqual({ salience: "fake:bottom-picker", analyst: "fake:analyst" });
    expect(run.analyst.topFindings).toHaveLength(1);
    expect(run.analyst.patterns).toHaveLength(1);
    expect(run.sweep.allInsights.length).toBeGreaterThan(0);
    // First run ever: every source counts as new.
    expect(run.changedDatasets.length).toBe(Object.keys(run.sourceFingerprints).length);
  });

  it("skips with zero model calls when no source changed since the last reasoned run", async () => {
    await runMonthlyReasoning({ salience: null, analyst: fakeAnalyst(), outDir, now: new Date("2026-10-01T13:00:00Z") });
    const analyst = fakeAnalyst();
    const salience = bottomPickingProvider();
    expect(await runMonthlyReasoning({ salience, analyst, outDir, now: new Date("2026-11-01T13:00:00Z") })).toEqual({ status: "skipped-unchanged" });
    expect(analyst.calls).toBe(0);
    expect(salience.prompts).toHaveLength(0);
  });

  it("re-runs anyway when forced", async () => {
    await runMonthlyReasoning({ salience: null, analyst: fakeAnalyst(), outDir, now: new Date("2026-10-01T13:00:00Z") });
    const outcome = await runMonthlyReasoning({ salience: null, analyst: fakeAnalyst(), outDir, force: true, now: new Date("2026-11-01T13:00:00Z") });
    expect(outcome.status).toBe("written");
    expect(fs.readdirSync(outDir)).toHaveLength(2);
  });
});

describe("currentReasonedRun", () => {
  it("returns the latest run only while its data fingerprints still match what's committed", async () => {
    await runMonthlyReasoning({ salience: null, analyst: fakeAnalyst(), outDir });
    const run = loadLatestReasonedRun(outDir)!;
    expect(currentReasonedRun(outDir, run.sourceFingerprints)).not.toBeNull();
    expect(currentReasonedRun(outDir, { ...run.sourceFingerprints, "home-health-care-agencies": "newer-pull" })).toBeNull();
  });

  it("returns null when no reasoned run exists", () => {
    expect(currentReasonedRun(outDir, {})).toBeNull();
  });
});
