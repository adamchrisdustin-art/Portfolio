import { describe, expect, it } from "vitest";
import {
  checkDuplicateIdentifiers,
  checkImpossibleDates,
  checkMissingFields,
  checkSchemaDrift,
  checkUnexpectedCategoryValues,
  checkUnexpectedGeographicLoss,
  checkUnexplainedVolumeChange,
  runAllChecks,
} from "./qualityChecks";

describe("checkMissingFields", () => {
  it("flags rows missing a required field", () => {
    const rows = [{ id: "1", name: "a" }, { id: "2" }, { id: "3", name: "" }];
    const issues = checkMissingFields(rows, ["name"]);
    expect(issues).toHaveLength(1);
    expect(issues[0].affectedCount).toBe(2);
  });
});

describe("checkDuplicateIdentifiers", () => {
  it("flags duplicate identifier values", () => {
    const rows = [{ id: "1" }, { id: "2" }, { id: "1" }];
    const issues = checkDuplicateIdentifiers(rows, "id");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });
  it("returns no issues when all identifiers are unique", () => {
    expect(checkDuplicateIdentifiers([{ id: "1" }, { id: "2" }], "id")).toHaveLength(0);
  });
});

describe("checkUnexpectedCategoryValues", () => {
  it("flags values outside the allow-list", () => {
    const rows = [{ type: "A" }, { type: "B" }, { type: "Z" }];
    const issues = checkUnexpectedCategoryValues(rows, "type", ["A", "B"]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Z");
  });
});

describe("checkImpossibleDates", () => {
  it("flags unparseable date strings", () => {
    const rows = [{ d: "2026-01-01" }, { d: "not-a-date" }];
    const issues = checkImpossibleDates(rows, "d");
    expect(issues).toHaveLength(1);
    expect(issues[0].affectedCount).toBe(1);
  });
});

describe("checkUnexplainedVolumeChange", () => {
  it("flags a swing beyond the threshold", () => {
    const issues = checkUnexplainedVolumeChange(1000, 1500, 25);
    expect(issues).toHaveLength(1);
  });
  it("allows a swing within the threshold", () => {
    expect(checkUnexplainedVolumeChange(1000, 1100, 25)).toHaveLength(0);
  });
});

describe("checkSchemaDrift", () => {
  it("flags removed fields as errors and added fields as warnings", () => {
    const issues = checkSchemaDrift(["a", "b", "c"], ["a", "b", "d"]);
    expect(issues.find((i) => i.severity === "error")?.message).toContain("c");
    expect(issues.find((i) => i.severity === "warning")?.message).toContain("d");
  });
});

describe("checkUnexpectedGeographicLoss", () => {
  it("flags a geography present before but missing now", () => {
    const issues = checkUnexpectedGeographicLoss(["AK", "AL", "AZ"], ["AL", "AZ"]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("AK");
  });
});

describe("runAllChecks", () => {
  it("aggregates issues and reports hasErrors correctly", () => {
    const result = runAllChecks([
      checkDuplicateIdentifiers([{ id: "1" }, { id: "1" }], "id"),
      checkSchemaDrift(["a"], ["a", "b"]),
    ]);
    expect(result.hasErrors).toBe(true);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });
});
