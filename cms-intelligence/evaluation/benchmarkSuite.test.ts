import { describe, expect, it } from "vitest";
import { getSourceById } from "../data/sources/registry";
import { BENCHMARK_SUITE } from "./benchmarkSuite";

describe("BENCHMARK_SUITE", () => {
  it("has exactly the 12 tasks docs/cms-intelligence/06_PHASE_6_MODEL_PROVIDER_EVALUATION.md requires", () => {
    expect(BENCHMARK_SUITE.length).toBe(12);
    const ids = new Set(BENCHMARK_SUITE.map((t) => t.taskId));
    expect(ids.size).toBe(12); // no duplicate task IDs
  });

  it("every expectedSource is a real, registered source - never an invented sourceId", () => {
    for (const task of BENCHMARK_SUITE) {
      for (const sourceId of task.expectedSources) {
        expect(getSourceById(sourceId), `${task.taskId} references unknown source "${sourceId}"`).toBeDefined();
      }
    }
  });

  it("refusal/gap tasks correctly leave requiredFacts and expectedSources empty - there's no real fact to require", () => {
    const refusalTasks = BENCHMARK_SUITE.filter((t) => t.expectRefusalOrGap);
    expect(refusalTasks.length).toBeGreaterThanOrEqual(2);
    for (const task of refusalTasks) {
      expect(task.requiredFacts).toEqual([]);
      expect(task.expectedSources).toEqual([]);
    }
  });

  it("every non-refusal task cites at least one real source and one required fact", () => {
    for (const task of BENCHMARK_SUITE.filter((t) => !t.expectRefusalOrGap)) {
      expect(task.expectedSources.length, `${task.taskId} has no expected source`).toBeGreaterThan(0);
      expect(task.requiredFacts.length, `${task.taskId} has no required fact`).toBeGreaterThan(0);
    }
  });

  it("every task has non-empty context, question, and at least one quality criterion", () => {
    for (const task of BENCHMARK_SUITE) {
      expect(task.context.length).toBeGreaterThan(20);
      expect(task.question.length).toBeGreaterThan(10);
      expect(task.qualityCriteria.length).toBeGreaterThan(0);
    }
  });
});
