import { beforeAll, describe, expect, it } from "vitest";
import { bottomPickingProvider, inventingProvider } from "../intelligence/salience/testProviders";
import { buildSalienceReport, captureSalienceCalls, runSalienceBenchmark, scoreSalienceResponse, type SalienceCall } from "./salienceBenchmark";

let calls: SalienceCall[];
beforeAll(async () => {
  calls = await captureSalienceCalls();
});

describe("captureSalienceCalls", () => {
  it("captures the real prompts production sends - one per ranked selection with more candidates than it shows", () => {
    expect(calls).toHaveLength(27); // 16 measured 2026-09-24; on 2026-09-25 +2 physician (provider types, states), +1 NIH institutes, +1 MA share shift, +2 services (categories, codes), +2 Marketplace (benchmark by state, issuers by state - the old 5-state issuer call showed every candidate, so it never counted), +1 Marketplace enrollment by state, +1 Medicaid enrollment by state, +1 Medicaid managed care by state
    for (const call of calls) {
      expect(call.topN).toBeGreaterThan(0);
      expect(Object.keys(call.candidates).length).toBeGreaterThan(call.topN);
      expect(call.taskDescription.length).toBeGreaterThan(0);
    }
  });
});

describe("scoreSalienceResponse", () => {
  it("accepts a valid pick and marks a reason that cites its own candidate's numbers as specific", () => {
    const call = calls[0];
    const [id, line] = Object.entries(call.candidates)[0];
    const number = line.match(/\d[\d,]*(?:\.\d+)?/g)!.find((n) => n.replace(/,/g, "").length >= 2)!;
    const result = scoreSalienceResponse(call, JSON.stringify([{ candidateId: id, rationale: `Stands out at ${number}.` }]), 10);
    expect(result.accepted).toBe(true);
    expect(result.specificRationales).toBe(1);
  });

  it("accepts but does not count a generic reason as specific", () => {
    const call = calls[0];
    const id = Object.keys(call.candidates)[0];
    const result = scoreSalienceResponse(call, JSON.stringify([{ candidateId: id, rationale: "This one matters most." }]), 10);
    expect(result.accepted).toBe(true);
    expect(result.specificRationales).toBe(0);
  });

  it("reports why production would reject an answer", () => {
    const call = calls[0];
    const id = Object.keys(call.candidates)[0];
    expect(scoreSalienceResponse(call, "prose, not JSON", 10).rejectionReason).toBe("not valid JSON");
    expect(scoreSalienceResponse(call, JSON.stringify([{ candidateId: "made-up", rationale: "x" }]), 10).rejectionReason).toMatch(/invented candidate id/);
    expect(scoreSalienceResponse(call, JSON.stringify([{ candidateId: id, rationale: "Up 987654%." }]), 10).rejectionReason).toMatch(/ungrounded/);
    expect(scoreSalienceResponse(call, null, 10).rejectionReason).toBe("no output");
  });
});

describe("runSalienceBenchmark", () => {
  it("scores a well-behaved model as 100% accepted and an inventing one as 0%", async () => {
    const good = await runSalienceBenchmark(bottomPickingProvider(), calls);
    const bad = await runSalienceBenchmark(inventingProvider(), calls);
    expect(good.aggregate.acceptanceRate).toBe(1);
    expect(good.aggregate.fillRate).toBe(1);
    expect(bad.aggregate.acceptanceRate).toBe(0);
    expect(buildSalienceReport([good, bad])).toMatch(/fake:bottom-picker \| 100%/);
  });
});
