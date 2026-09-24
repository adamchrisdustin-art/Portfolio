import { describe, expect, it } from "vitest";
import { checkAllSources, isSourceRegistered } from "./agent";

/**
 * Runs against the real, committed snapshot data in this repo (both
 * data/cms/hospital-general-information/ and
 * data/healthcare-intelligence/home-health-care-agencies/), same as
 * agents/orchestrator/orchestrator.test.ts - not mocked.
 */
describe("checkAllSources", () => {
  it("checks every verified-implemented registry source without throwing", () => {
    const results = checkAllSources();
    const sourceIds = results.map((r) => r.sourceId);
    expect(sourceIds).toContain("cms:hospital-general-information");
    expect(sourceIds).toContain("cms:home-health-care-agencies");
  });

  it("reports a real status for each source, never silently skipping", () => {
    const results = checkAllSources();
    for (const result of results) {
      expect(["no-data-yet", "baseline", "unchanged", "changed", "unreachable"]).toContain(result.status);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});

describe("isSourceRegistered", () => {
  it("recognizes a real registered source", () => {
    expect(isSourceRegistered("cms:hospital-general-information")).toBe(true);
  });
  it("returns false for an unregistered id", () => {
    expect(isSourceRegistered("cms:not-a-real-source")).toBe(false);
  });
});
