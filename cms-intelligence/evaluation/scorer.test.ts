import { describe, expect, it } from "vitest";
import { BENCHMARK_SUITE } from "./benchmarkSuite";
import { scoreResponse } from "./scorer";

const task = (id: string) => BENCHMARK_SUITE.find((t) => t.taskId === id)!;

describe("scoreResponse - forbidden claims", () => {
  const reimbursement = task("cms-eval-002-reimbursement-change");

  it("does not penalize a model for disclaiming the phrase (real answers from the 2026-09-25 runs)", () => {
    for (const output of [
      "The data covers only **WA, CA, TX, NY, and FL**, not the full national file.",
      "Based on a 5-state sample and does not represent the full national file.",
      "It is **not the full national file**.",
      "The system’s sample is 5 states rather than the full national dataset.",
    ]) {
      expect(scoreResponse(reimbursement, "t", output, 0).forbiddenClaimsTriggered, output).toEqual([]);
    }
  });

  it("still penalizes the claim when it's actually asserted", () => {
    expect(scoreResponse(reimbursement, "t", "This reflects the full national file of Medicare claims.", 0).forbiddenClaimsTriggered).toEqual(["full national"]);
  });

  it("penalizes an assertion even if the same phrase is disclaimed elsewhere in the answer", () => {
    const output = "This is not the full national file. That said, the full national picture is identical.";
    expect(scoreResponse(reimbursement, "t", output, 0).forbiddenClaimsTriggered).toEqual(["full national"]);
  });
});

describe("scoreResponse - refusals", () => {
  const siteOfCare = task("cms-eval-006-site-of-care-change");

  it("recognizes the real refusals every model gave on cms-eval-006, including curly apostrophes", () => {
    for (const output of [
      "I cannot answer this question based on the available data sources.",
      "This system cannot answer that question with its currently wired data sources.",
      "The system’s current data sources cannot show a recent site-of-care shift or quantify one.",
      "The context does not provide any specific information regarding a recent site-of-care shift.",
      "Any percentage or trend I gave you would be invented.",
    ]) {
      const result = scoreResponse(siteOfCare, "t", output, 0);
      expect(result.refusalCorrect, output).toBe(true);
      expect(result.score, output).toBe(1);
    }
  });

  it("still fails an answer that invents a figure instead of refusing", () => {
    const result = scoreResponse(siteOfCare, "t", "Outpatient volume rose 12% as care shifted out of hospitals.", 0);
    expect(result.refusalCorrect).toBe(false);
    expect(result.score).toBe(0);
  });
});
