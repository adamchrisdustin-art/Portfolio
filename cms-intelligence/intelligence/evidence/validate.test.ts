import { describe, expect, it } from "vitest";
import type { Insight } from "./schema";
import { InsightValidationError, validateInsight } from "./validate";

function baseInsight(): Insight {
  return {
    id: "sig-test-001",
    headline: "Test headline",
    questionId: "Q001",
    signalType: "baseline",
    period: { start: "2026-01-01", end: "2026-06-30" },
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: 42, unit: "count" },
    drivers: [
      {
        description: "test driver",
        supportingEvidenceIds: ["ev-1"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Test relevance.",
    evidence: [{ id: "ev-1", sourceId: "cms:test", description: "test evidence", datasetVintage: "2026-06-01" }],
    contradictoryEvidence: [],
    confidence: "low",
    confidenceRationale: "Only one data point exists so far.",
    freshness: { dataAsOf: "2026-06-01", generatedAt: "2026-06-01T00:00:00Z", isStale: false },
    limitations: [],
    nextSignal: "Watch the next refresh cycle.",
    recommendedInternalValidation: "Not applicable for this test fixture.",
    sourceIds: ["cms:test"],
    generatingAgent: "test-agent",
  };
}

describe("validateInsight", () => {
  it("accepts a well-formed insight", () => {
    expect(() => validateInsight(baseInsight())).not.toThrow();
  });

  it("rejects a missing evidence array", () => {
    const bad = baseInsight();
    bad.evidence = [];
    expect(() => validateInsight(bad)).toThrow(InsightValidationError);
  });

  it("rejects an invalid population enum value", () => {
    const bad = baseInsight() as unknown as Record<string, unknown>;
    bad.population = "some-made-up-population";
    expect(() => validateInsight(bad)).toThrow(/population/);
  });

  it("rejects a confidence rationale that's just a restated label", () => {
    const bad = baseInsight();
    bad.confidenceRationale = "low";
    expect(() => validateInsight(bad)).toThrow(/confidenceRationale/);
  });

  it("rejects a driver with no supporting evidence", () => {
    const bad = baseInsight();
    bad.drivers = [{ description: "unsupported claim", supportingEvidenceIds: [], relationship: "correlation" }];
    expect(() => validateInsight(bad)).toThrow(/driver/);
  });

  it("rejects an empty sourceIds array", () => {
    const bad = baseInsight();
    bad.sourceIds = [];
    expect(() => validateInsight(bad)).toThrow(/sourceIds/);
  });
});
