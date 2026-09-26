import { describe, expect, it } from "vitest";
import { stateCode } from "../sources/states";
import { isSpecialtyPlan, loadLatestSnapshot, normalizeParent, toPlanRow } from "./medicaidManagedCare";

describe("stateCode", () => {
  it("maps CMS state names, including DC, and leaves territories out", () => {
    expect(stateCode("Texas")).toBe("TX");
    expect(stateCode("District of Columbia")).toBe("DC");
    expect(stateCode("District Of Columbia ")).toBe("DC");
    expect(stateCode("Puerto Rico")).toBeNull();
    expect(stateCode("TOTALS")).toBeNull();
  });
});

describe("toPlanRow", () => {
  const raw = { state: "Texas", program_name: "STAR (Comprehensive MCO)", plan_name: "Aetna", parent_organization: "", medicaidonly_enrollment: "72,966", dual_enrollment: "0", total_enrollment: "72,966", year: "2016" };

  it("keeps the fields used, with counts parsed and the state as a code", () => {
    expect(toPlanRow(raw)).toMatchObject({ year: 2016, state: "TX", plan: "Aetna", parent: "", comprehensive: true, totalEnrollment: 72966, dualEnrollment: 0 });
  });

  it("counts only comprehensive programs, and not the dental or pharmacy plans some states list inside them", () => {
    expect(toPlanRow({ ...raw, program_name: "Dental Managed Care (Dental only (PAHP))" })?.comprehensive).toBe(false);
    expect(toPlanRow({ ...raw, program_name: "TennCare III (Comprehensive MCO + MLTSS)", plan_name: "DentaQuest USA Insurance Company" })?.comprehensive).toBe(false);
    expect(toPlanRow({ ...raw, program_name: "TennCare III (Comprehensive MCO + MLTSS)", plan_name: "OptumRx", parent_organization: "OptumRx Holdings, LLC" })?.comprehensive).toBe(false);
  });

  it("stores unreported counts as missing, never zero", () => {
    expect(toPlanRow({ ...raw, total_enrollment: "n/a" })?.totalEnrollment).toBeNull();
    expect(toPlanRow({ ...raw, total_enrollment: "--" })?.totalEnrollment).toBeNull();
    expect(toPlanRow({ ...raw, year: "" })).toBeNull();
  });
});

describe("isSpecialtyPlan", () => {
  it("catches dental and pharmacy benefit plans but not medical plans with similar words", () => {
    expect(isSpecialtyPlan("Managed Dental Care of Oregon", "HealthShare of Oregon")).toBe(true);
    expect(isSpecialtyPlan("Independent Health Association", "Independent Health Association")).toBe(false);
    expect(isSpecialtyPlan("Alliance Behavioral Healthcare", "Alliance Behavioral Healthcare")).toBe(false);
  });
});

describe("normalizeParent", () => {
  it("merges spellings of one name only", () => {
    expect(normalizeParent("Molina Healthcare, Inc.")).toBe("Molina Healthcare");
    expect(normalizeParent("Centene Corporation")).toBe(normalizeParent("Centene"));
    expect(normalizeParent("UnitedHealthcare")).not.toBe(normalizeParent("UnitedHealth Group"));
  });
});

describe("the committed snapshot", () => {
  it("has 2016 through at least 2024", () => {
    const years = new Set(loadLatestSnapshot()!.rows.map((r) => r.year));
    expect(years.has(2016) && years.has(2024)).toBe(true);
  });
});
