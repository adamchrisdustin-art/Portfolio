import { describe, expect, it } from "vitest";
import type { OepYear } from "../data/adapters/marketplaceEnrollment";
import type { MarketplaceYearSummary, StateSummary } from "../data/adapters/marketplaceRatePuf";
import type { ServiceRow, ServiceYearData } from "../data/adapters/physicianServiceSummary";
import { buildOutlierFacts, MAX_SERVICE_OUTLIERS, outlierFactsFrom, SERVICE_MIN_DOLLAR_CHANGE, type OutlierInputs } from "./outlierFacts";

const STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID".split(" ");
const empty: OutlierInputs = { physicianYears: [], serviceYears: [], oepYears: [], planYears: [], homeHealth: null, medicaid: null };

function planYear(planYear: number, benchmarks: Record<string, number>): MarketplaceYearSummary {
  return {
    dataset: "marketplace-rate-puf",
    planYear,
    referenceAge: "40",
    pulledAt: "2026-09-25T00:00:00Z",
    sourceUrls: [],
    counts: { rateLines: 0, keptRows: 0, implausibleRates: 0, malformedLines: 0 },
    ratingAreas: [],
    states: Object.entries(benchmarks).map(([state, benchmarkMedian]) => ({ state, benchmarkMedian }) as StateSummary),
  };
}

function oepYear(planYear: number, consumers: Record<string, number>): OepYear {
  return {
    dataset: "marketplace-oep-state",
    planYear,
    sourceUrl: "",
    pulledAt: "",
    columns: ["Cnsmr", "New_Cnsmr"],
    suppressedCells: 0,
    rows: [
      ...Object.entries(consumers).map(([state, n]) => ({ state, platform: "HC.gov", values: [n, n] })),
      { state: "Total", platform: "All", values: [1, 1] },
    ],
  };
}

function serviceYear(dataYear: number, rows: [string, number][]): ServiceYearData {
  return {
    dataset: "medicare-physician-by-service-summary",
    dataYear,
    datasetId: "",
    services: rows.map(([code, standardizedPayment]) => ({ code, description: `Service ${code}`, isDrug: false, standardizedPayment }) as ServiceRow),
  };
}

describe("outlierFactsFrom", () => {
  it("returns nothing when there is no data", () => {
    expect(outlierFactsFrom(empty)).toEqual([]);
  });

  it("lists a state far from the rest with display values the analyst can copy", () => {
    const prior = Object.fromEntries(STATES.map((s) => [s, 500]));
    const current = Object.fromEntries(STATES.map((s, i) => [s, 600 + (i % 3)]));
    current.AR = 845.5;
    const facts = outlierFactsFrom({ ...empty, planYears: [planYear(2026, current), planYear(2025, prior)] });

    const level = facts.find((f) => f.metric.startsWith("Monthly benchmark"))!;
    expect(level.period).toBe("plan year 2026");
    expect(level.outliers).toEqual([expect.objectContaining({ id: "AR", value: "$845.50", direction: "above" })]);

    const change = facts.find((f) => f.metric.startsWith("Year-over-year change in the benchmark"))!;
    expect(change.period).toBe("plan year 2025 to 2026");
    expect(change.median).toBe("20.2%");
    expect(change.outliers[0]).toMatchObject({ id: "AR", value: "69.1%" });
  });

  it("keeps a metric with no outliers so the analyst knows it was checked", () => {
    const prior = Object.fromEntries(STATES.map((s) => [s, 1000]));
    const current = Object.fromEntries(STATES.map((s, i) => [s, 900 + i * 10]));
    const facts = outlierFactsFrom({ ...empty, oepYears: [oepYear(2025, prior), oepYear(2026, current)] });
    expect(facts.map((f) => [f.metric, f.flaggedCount, f.outliers.length])).toEqual([
      ["Year-over-year change in Marketplace open-enrollment plan selections (consumers)", 0, 0],
      ["Year-over-year change in new Marketplace consumers", 0, 0],
    ]);
  });

  it("lists only service outliers that moved enough money, capped, and counts every flagged code", () => {
    const codes = Array.from({ length: 40 }, (_, i) => `C${i}`);
    const prior = codes.map((c) => [c, 100_000_000] as [string, number]);
    // Ordinary codes grow 0-2%; 12 big codes triple; one small-dollar code triples too but below the dollar floor.
    const current = codes.map((c, i) => [c, 100_000_000 * (i < 12 ? 3 : 1 + (i % 3) / 100)] as [string, number]);
    prior.push(["SMALL", 50_000_000]);
    current.push(["SMALL", 50_000_000 + SERVICE_MIN_DOLLAR_CHANGE - 1]);
    const [facts] = outlierFactsFrom({ ...empty, serviceYears: [serviceYear(2023, prior), serviceYear(2024, current)] });

    // SMALL is flagged by the rule but not listed: it moved less than the dollar floor.
    expect(facts.flaggedCount).toBe(13);
    expect(facts.outliers).toHaveLength(MAX_SERVICE_OUTLIERS);
    expect(facts.outliers.map((o) => o.id)).not.toContain("SMALL");
    expect(facts.outliers[0]).toMatchObject({ value: "200.0%", detail: "standardized payment change +$200.0M" });
  });
});

describe("buildOutlierFacts over the committed data", () => {
  it("builds facts from every wired source", () => {
    const facts = buildOutlierFacts();
    const sources = new Set(facts.map((f) => f.sourceId));
    for (const id of ["cms:medicare-physician-by-provider", "cms:medicare-physician-by-service", "cms:marketplace-oep-state", "cms:marketplace-rate-puf", "cms:home-health-care-agencies", "cms:medicaid-state-enrollment"]) {
      expect(sources).toContain(id);
    }
    for (const f of facts) expect(f.outliers.length).toBeLessThanOrEqual(f.flaggedCount);
  });
});
