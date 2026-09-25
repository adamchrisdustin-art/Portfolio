import { describe, expect, it } from "vitest";
import { comparePeriods, type PeriodComparison } from "./periodComparison";

/** `count` events on the 15th of the given month. */
function events(month: string, count: number): string[] {
  return Array.from({ length: count }, () => `${month}-15`);
}

function find(results: PeriodComparison[], view: string, period: string): PeriodComparison | undefined {
  return results.find((r) => r.view === view && r.current.period === period);
}

const base = { coverageStart: "2024-09-25", asOf: "2026-09-25", seasonal: false };

describe("comparePeriods", () => {
  it("compares only complete calendar periods (the pull month is never the current period)", () => {
    const results = comparePeriods({ ...base, dates: [...events("2026-07", 30), ...events("2026-08", 14), ...events("2026-09", 99)] });
    const mom = results.find((r) => r.view === "month-over-month")!;
    expect(mom.current).toEqual({ period: "2026-08", count: 14 });
    expect(mom.prior).toEqual({ period: "2026-07", count: 30 });
    expect(mom.change).toBe(-16);
    expect(mom.percentChange).toBe(-53.3);
  });

  it("labels quarters and halves by calendar, and aligns year-over-year to the same period a year earlier", () => {
    const results = comparePeriods({ ...base, dates: [] });
    expect(find(results, "quarter-over-quarter", "2026-Q2")?.prior.period).toBe("2026-Q1");
    expect(find(results, "half-over-half", "2026-H1")?.prior.period).toBe("2025-H2");
    expect(find(results, "year-over-year", "2026-Q2")?.prior.period).toBe("2025-Q2");
    expect(find(results, "year-over-year", "2026-H1")?.prior.period).toBe("2025-H1");
  });

  it("omits a view whose prior period starts before the data's coverage (never compares a partial period)", () => {
    // Coverage starts 2024-09-25, so September 2024 is partial and the trailing-12-month view needs Sep 2024.
    const results = comparePeriods({ ...base, dates: [] });
    expect(results.some((r) => r.current.period.includes(" to "))).toBe(false);
    // One pull later, 24 complete months exist and it appears.
    const later = comparePeriods({ ...base, asOf: "2026-10-01", dates: [] });
    expect(later.find((r) => r.current.period === "2025-10 to 2026-09")?.prior.period).toBe("2024-10 to 2025-09");
  });

  it("marks a change beyond 2 standard deviations of chance variation as notable", () => {
    // 50 vs 20: threshold 2*sqrt(70) = 16.7, change 30.
    const results = comparePeriods({ ...base, dates: [...events("2026-07", 20), ...events("2026-08", 50)] });
    const mom = results.find((r) => r.view === "month-over-month")!;
    expect(mom.notable).toBe(true);
    expect(mom.basis).toMatch(/beyond 2 standard deviations/);
  });

  it("does not mark a change within chance variation as notable", () => {
    // 50 vs 45: threshold 2*sqrt(95) = 19.5, change 5.
    const mom = comparePeriods({ ...base, dates: [...events("2026-07", 45), ...events("2026-08", 50)] }).find((r) => r.view === "month-over-month")!;
    expect(mom.notable).toBe(false);
  });

  it("never marks a comparison notable when both periods are under the 11-count floor, however large the percent change", () => {
    const mom = comparePeriods({ ...base, dates: [...events("2026-07", 1), ...events("2026-08", 9)] }).find((r) => r.view === "month-over-month")!;
    expect(mom.percentChange).toBe(800);
    expect(mom.notable).toBe(false);
    expect(mom.basis).toMatch(/11-count floor/);
  });

  it("lets only year-over-year views be notable for a seasonal metric", () => {
    const dates = [...events("2025-08", 10), ...events("2026-07", 10), ...events("2026-08", 60)];
    const results = comparePeriods({ ...base, seasonal: true, dates });
    expect(results.find((r) => r.view === "month-over-month")?.notable).toBe(false);
    expect(results.find((r) => r.view === "month-over-month")?.basis).toMatch(/annual cycle/);
    expect(find(results, "year-over-year", "2026-Q2")).toBeDefined();
  });

  it("reports a null percent change rather than dividing by a zero prior count", () => {
    const mom = comparePeriods({ ...base, dates: events("2026-08", 12) }).find((r) => r.view === "month-over-month")!;
    expect(mom.prior.count).toBe(0);
    expect(mom.percentChange).toBeNull();
  });
});
