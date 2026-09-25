import { describe, expect, it } from "vitest";
import { bestReportFor, comparableValue, loadLatestSnapshot, parseCount, toReport, type MedicaidReport } from "./medicaidEnrollment";

describe("parseCount", () => {
  it("reads plain and comma-formatted counts, and treats blanks as missing, never zero", () => {
    expect(parseCount("1358101")).toBe(1358101);
    expect(parseCount("1,358,101")).toBe(1358101);
    expect(parseCount("0.0090")).toBe(0.009);
    expect(parseCount("")).toBeNull();
    expect(parseCount(null)).toBeNull();
    expect(parseCount("n/a")).toBeNull();
  });
});

describe("toReport", () => {
  const raw = {
    state_abbreviation: "NC",
    reporting_period: "202606",
    preliminary_or_updated: "P",
    state_expanded_medicaid: "Y",
    total_medicaid_and_chip_enrollment: "2811382",
    total_medicaid_enrollment: "2461148",
    total_chip_enrollment: "350234",
    total_adult_medicaid_enrollment: "1453281",
    medicaid_and_chip_child_enrollment: "1358101",
    new_applications_submitted_to_medicaid_and_chip_agencies: "33370",
    total_medicaid_and_chip_determinations: "",
  };

  it("keeps the fields used, with the month as YYYY-MM", () => {
    expect(toReport(raw)).toEqual({
      state: "NC",
      month: "2026-06",
      status: "P",
      expandedMedicaid: true,
      totalEnrollment: 2811382,
      medicaidEnrollment: 2461148,
      chipEnrollment: 350234,
      adultMedicaidEnrollment: 1453281,
      childEnrollment: 1358101,
      newApplications: 33370,
      determinations: null,
    });
  });

  it("rejects rows that aren't a usable state-month report", () => {
    expect(toReport({ ...raw, state_abbreviation: "" })).toBeNull();
    expect(toReport({ ...raw, reporting_period: "2026" })).toBeNull();
    expect(toReport({ ...raw, preliminary_or_updated: "X" })).toBeNull();
  });
});

describe("report status", () => {
  const report = (month: string, status: "P" | "U", totalEnrollment: number) => ({ state: "NC", month, status, expandedMedicaid: true, totalEnrollment }) as MedicaidReport;
  const reports = [report("2026-05", "P", 2820258), report("2026-05", "U", 2835788), report("2026-06", "P", 2811382)];

  it("prefers the final report for a month, falling back to the preliminary one", () => {
    expect(bestReportFor(reports, "NC", "2026-05")?.totalEnrollment).toBe(2835788);
    expect(bestReportFor(reports, "NC", "2026-06")?.totalEnrollment).toBe(2811382);
    expect(bestReportFor(reports, "NC", "2026-07")).toBeNull();
  });

  it("returns a value only in the status asked for, so comparisons stay like with like", () => {
    expect(comparableValue(reports, "NC", "2026-05", "P", "totalEnrollment")).toBe(2820258);
    expect(comparableValue(reports, "NC", "2026-06", "U", "totalEnrollment")).toBeNull();
  });
});

describe("the committed snapshot", () => {
  it("covers every state and DC through a recent month", () => {
    const snapshot = loadLatestSnapshot()!;
    expect(new Set(snapshot.reports.map((r) => r.state)).size).toBe(51);
    expect(snapshot.reports.map((r) => r.month).sort().at(-1)! >= "2026-06").toBe(true);
  });
});
