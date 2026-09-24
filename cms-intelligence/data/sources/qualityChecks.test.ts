import { describe, expect, it } from "vitest";
import {
  checkDataTypeChange,
  checkDatasetRetired,
  checkDuplicateIdentifiers,
  checkImpossibleDates,
  checkMissingFields,
  checkPublicationDateChanged,
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

  it("a renamed field reads as a paired removed+added issue, not a silent no-op", () => {
    // "facility_name" renamed to "facilityName" between snapshots - checkSchemaDrift
    // has no rename-specific detection, so this documents how the rename actually
    // surfaces today: one error (old name gone) + one warning (new name appeared).
    const issues = checkSchemaDrift(["id", "facility_name"], ["id", "facilityName"]);
    expect(issues).toHaveLength(2);
    expect(issues.find((i) => i.severity === "error")?.message).toContain("facility_name");
    expect(issues.find((i) => i.severity === "warning")?.message).toContain("facilityName");
  });
});

describe("checkDataTypeChange", () => {
  it("flags a field whose dominant type changed between snapshots", () => {
    const previous = [{ rate: "1.5" }, { rate: "2.0" }, { rate: "1.8" }];
    const current = [{ rate: 1.5 }, { rate: 2.0 }, { rate: 1.8 }];
    const issues = checkDataTypeChange("rate", previous, current);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toContain("string");
    expect(issues[0].message).toContain("number");
  });

  it("does not flag when the dominant type is unchanged", () => {
    expect(checkDataTypeChange("rate", [{ rate: 1 }, { rate: 2 }], [{ rate: 3 }, { rate: 4 }])).toHaveLength(0);
  });

  it("does not flag when a field is entirely absent in either snapshot", () => {
    expect(checkDataTypeChange("rate", [{ other: 1 }], [{ other: 2 }])).toHaveLength(0);
  });
});

describe("checkPublicationDateChanged", () => {
  it("flags a publication date moving backward as an error", () => {
    const issues = checkPublicationDateChanged("2026-06-01", "2026-01-01");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });

  it("flags a publication date advancing as a warning", () => {
    const issues = checkPublicationDateChanged("2026-01-01", "2026-06-01");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("does not flag an unchanged publication date", () => {
    expect(checkPublicationDateChanged("2026-01-01", "2026-01-01")).toHaveLength(0);
  });

  it("does not flag when either date is missing", () => {
    expect(checkPublicationDateChanged(null, "2026-01-01")).toHaveLength(0);
    expect(checkPublicationDateChanged("2026-01-01", null)).toHaveLength(0);
  });
});

describe("checkDatasetRetired", () => {
  it("flags a previously-populated source now returning zero rows", () => {
    const issues = checkDatasetRetired(5000, 0);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });

  it("flags a previously-populated source now returning no response at all", () => {
    const issues = checkDatasetRetired(5000, null);
    expect(issues[0].message).toContain("no response");
  });

  it("does not flag a source that still has rows", () => {
    expect(checkDatasetRetired(5000, 4800)).toHaveLength(0);
  });

  it("does not flag a source that was already empty", () => {
    expect(checkDatasetRetired(0, 0)).toHaveLength(0);
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
