import { describe, expect, it } from "vitest";
import type { ManagedCarePlanRow, ManagedCareSnapshot } from "../../data/adapters/medicaidManagedCare";
import { managedCareInsights } from "./managedCareInsights";

const ctx = { modelProvider: null } as never;
const row = (year: number, state: string | null, parent: string, totalEnrollment: number, comprehensive = true): ManagedCarePlanRow => ({
  year, state, stateName: state ?? "Puerto Rico", program: comprehensive ? "X (Comprehensive MCO)" : "Dental (Dental only (PAHP))", plan: `${parent} plan`, parent, comprehensive, medicaidOnlyEnrollment: null, dualEnrollment: null, totalEnrollment,
});
const snapshot = (rows: ManagedCarePlanRow[]): ManagedCareSnapshot => ({ dataset: "d", datasetId: "x", pulledAt: "2026-09-26T00:00:00Z", rowCount: rows.length, rows });

const STATES = ["TX", "FL", "CA", "NY", "OH", "GA", "MI", "NJ", "PA", "IL"];
const rows = [
  ...STATES.flatMap((s) => [row(2023, s, "Centene Corporation", 1000), row(2024, s, "Centene", s === "TX" ? 500 : 900)]),
  row(2023, "TX", "Molina Healthcare, Inc.", 400),
  row(2024, "TX", "Molina Healthcare", 440),
  row(2024, "TX", "DentalCo", 5000, false), // dental program: not counted
  row(2024, null, "Territory Plan", 9000), // territory: not counted
];

describe("managedCareInsights", () => {
  it("returns nothing without two years of data", async () => {
    expect(await managedCareInsights(ctx, null)).toEqual([]);
    expect(await managedCareInsights(ctx, snapshot(rows.filter((r) => r.year === 2024)))).toEqual([]);
  });

  it("sums comprehensive plans by state, leaving out other programs and territories", async () => {
    const [byState] = await managedCareInsights(ctx, snapshot(rows));
    // 2023: 10 x 1,000 + 400 = 10,400. 2024: 500 + 9 x 900 + 440 = 9,040.
    expect(byState.drivers[0].description).toContain("0.01M in 2023 to 0.01M in 2024 (-13.1%) across 10 states");
    expect(byState.headline).toMatch(/TX changed most \(-32\.9%\)/);
  });

  it("groups parents only by spellings of one name, and says names are as states report them", async () => {
    const [, parents] = await managedCareInsights(ctx, snapshot(rows));
    expect(parents.headline).toMatch(/^Among parent organizations as named in states' 2024 reports, Centene had the most/);
    expect(parents.drivers[0].description).toContain("Molina Healthcare: 0.00M in 1 state (0.00M in 2023, +10.0%)");
    expect(parents.limitations.some((l) => l.includes("several parent names"))).toBe(true);
  });
});
