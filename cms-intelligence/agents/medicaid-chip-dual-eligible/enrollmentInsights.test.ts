import { describe, expect, it } from "vitest";
import type { MedicaidEnrollmentSnapshot, MedicaidReport } from "../../data/adapters/medicaidEnrollment";
import { medicaidEnrollmentInsights } from "./enrollmentInsights";

const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI".split(" ");
const ctx = { modelProvider: null } as never;

function report(state: string, month: string, status: "P" | "U", totalEnrollment: number): MedicaidReport {
  return { state, month, status, expandedMedicaid: state !== "AL", totalEnrollment, medicaidEnrollment: null, chipEnrollment: null, adultMedicaidEnrollment: totalEnrollment / 2, childEnrollment: totalEnrollment / 2, newApplications: null, determinations: null };
}

/** 14 months of final reports at 1,000 per state, then the newest month preliminary only. Preliminary runs 1% below final. */
function snapshot(newestPrelim: (state: string) => number): MedicaidEnrollmentSnapshot {
  const months = Array.from({ length: 13 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}`.replace("2025-13", "2026-01"));
  const reports = STATES.flatMap((state) => [
    ...months.flatMap((m) => [report(state, m, "U", 1000), report(state, m, "P", 990)]),
    ...["2024-01", "2023-01", "2022-01"].map((m) => report(state, m, "U", 1000)),
    report(state, "2026-02", "P", newestPrelim(state)),
  ]);
  return { dataset: "medicaid-state-enrollment", datasetId: "x", pulledAt: "2026-09-25T00:00:00Z", reportCount: reports.length, reports };
}

describe("medicaidEnrollmentInsights", () => {
  it("returns nothing without data", async () => {
    expect(await medicaidEnrollmentInsights(ctx, null)).toEqual([]);
  });

  it("compares the newest preliminary month only with the preliminary month a year earlier", async () => {
    // Unchanged preliminary counts: a preliminary-vs-final comparison would wrongly show a 1% drop.
    const [national, byState] = await medicaidEnrollmentInsights(ctx, snapshot(() => 990));
    expect(national.headline).toMatch(/rose 0\.0%|fell 0\.0%/);
    expect(national.magnitude.value).toBeCloseTo(0);
    expect(byState.id).toBe("sig-medicaid-2026-02-enrollment-by-state");
  });

  it("labels each state figure with its report month and status", async () => {
    const [, byState] = await medicaidEnrollmentInsights(ctx, snapshot((s) => (s === "CA" ? 792 : 990)));
    expect(byState.headline).toMatch(/^CA had the steepest/);
    expect(byState.drivers[0].description).toContain("CA: 990 to 792 enrollees (-20.0%; February 2026 vs February 2025, both preliminary)");
  });

  it("builds the national history from final reports only", async () => {
    const [national] = await medicaidEnrollmentInsights(ctx, snapshot(() => 990));
    expect(national.series!.points.every((p) => p.value === STATES.length * 1000)).toBe(true);
  });
});
