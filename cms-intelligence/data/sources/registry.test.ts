import { describe, expect, it } from "vitest";
import { getSourceById, getSourcesForQuestion, SOURCE_REGISTRY } from "./registry";

describe("SOURCE_REGISTRY", () => {
  it("every entry maps to at least one executive question (acceptance criterion: every source maps back to questions)", () => {
    for (const source of SOURCE_REGISTRY) {
      expect(source.relatedQuestionIds.length).toBeGreaterThan(0);
    }
  });

  it("verified-implemented sources have a real URL and verification dates", () => {
    const verified = SOURCE_REGISTRY.filter((s) => s.verificationStatus === "verified-implemented");
    expect(verified.length).toBeGreaterThanOrEqual(2);
    for (const source of verified) {
      expect(source.urlOrApi).toMatch(/^https:\/\//);
      expect(source.lastVerified).not.toBeNull();
      expect(source.lastSchemaCheck).not.toBeNull();
    }
  });

  it("candidate-unverified sources never claim a verified URL or vintage", () => {
    const candidates = SOURCE_REGISTRY.filter((s) => s.verificationStatus === "candidate-unverified");
    expect(candidates.length).toBeGreaterThan(0);
    for (const source of candidates) {
      expect(source.lastVerified).toBeNull();
      expect(source.latestVintage).toBeNull();
    }
  });
});

describe("getSourceById", () => {
  it("finds a real source by id", () => {
    expect(getSourceById("cms:hospital-general-information")?.sourceName).toBe("Hospital General Information");
  });
  it("returns undefined for an unknown id", () => {
    expect(getSourceById("cms:nonexistent")).toBeUndefined();
  });
});

describe("getSourcesForQuestion", () => {
  it("finds sources related to a given question", () => {
    const sources = getSourcesForQuestion("Q012");
    expect(sources.some((s) => s.sourceId === "cms:home-health-care-agencies")).toBe(true);
  });
});
