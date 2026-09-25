import { describe, expect, it } from "vitest";
import type { MarketplaceYearSummary, StateSummary } from "../../data/adapters/marketplaceRatePuf";
import { coverageChanges, issuerFlows, panelSeries, panelStates, stateChanges } from "./marketplaceTrends";

const state = (code: string, benchmark: number, issuerIds: string[]): StateSummary => ({
  state: code,
  issuerIds,
  plans: 10,
  plansByMetal: {},
  plansByType: {},
  ratingAreas: 1,
  benchmarkMedian: benchmark,
  lowestBronzeMedian: null,
  silverDeductibleMedian: null,
  bronzeDeductibleMedian: null,
  silverMoopMedian: null,
});
const year = (planYear: number, states: StateSummary[]): MarketplaceYearSummary => ({
  dataset: "x",
  planYear,
  referenceAge: "40",
  pulledAt: "2026-09-25T00:00:00Z",
  sourceUrls: [],
  counts: { rateLines: 0, keptRows: 0, implausibleRates: 0, malformedLines: 0 },
  states,
  ratingAreas: [],
});

// PA leaves HealthCare.gov in 2025: a naive median would jump from the change in which states are counted.
const y2024 = year(2024, [state("FL", 500, ["a", "b"]), state("TX", 400, ["c"]), state("PA", 900, ["d"])]);
const y2025 = year(2025, [state("FL", 550, ["b", "e"]), state("TX", 440, ["c"])]);

describe("marketplace like-for-like trends", () => {
  it("builds series only from states present in every year", () => {
    expect(panelStates([y2024, y2025])).toEqual(["FL", "TX"]);
    expect(panelSeries([y2024, y2025], "benchmarkMedian")).toEqual([
      { year: 2024, value: 450 },
      { year: 2025, value: 495 },
    ]);
  });

  it("compares states present in both years and reports coverage changes", () => {
    const changes = stateChanges(y2025, y2024, "benchmarkMedian");
    expect(changes.map((c) => c.state)).toEqual(["FL", "TX"]);
    expect(changes[0].growth).toBeCloseTo(0.1);
    expect(coverageChanges(y2025, y2024)).toEqual({ left: ["PA"], joined: [] });
  });

  it("counts issuer entry and exit by id", () => {
    const fl = issuerFlows(y2025, y2024).find((f) => f.state === "FL")!;
    expect(fl).toMatchObject({ issuers: 2, priorIssuers: 2, entered: 1, exited: 1 });
  });
});
