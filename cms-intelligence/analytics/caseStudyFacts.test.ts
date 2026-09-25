import { describe, expect, it } from "vitest";
import { buildCaseStudyFacts, describeDuration } from "./caseStudyFacts";

describe("buildCaseStudyFacts", () => {
  it("reads real ranges from the committed data", () => {
    const facts = buildCaseStudyFacts();
    expect(facts.physician!.firstYear).toBeLessThan(facts.physician!.lastYear);
    expect(facts.physician!.latestProviderCount).toBeGreaterThan(100_000);
    expect(facts.maMonths!.count).toBeGreaterThan(12);
    expect(facts.maMonths!.first < facts.maMonths!.last).toBe(true);
    expect(facts.marketplacePlanYears!.first).toBeLessThan(facts.marketplacePlanYears!.last);
    expect(facts.snapshotHistoryDays).toBeGreaterThanOrEqual(0);
    expect(facts.rollingWindowDays.length).toBeGreaterThan(0);
  });
});

describe("describeDuration", () => {
  it("phrases history lengths for prose", () => {
    expect(describeDuration(1)).toBe("a single day");
    expect(describeDuration(7)).toBe("about a week");
    expect(describeDuration(9)).toBe("9 days");
    expect(describeDuration(21)).toBe("about 3 weeks");
    expect(describeDuration(90)).toBe("about 3 months");
  });
});
