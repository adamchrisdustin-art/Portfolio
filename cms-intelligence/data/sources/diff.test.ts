import { describe, expect, it } from "vitest";
import { diffRows, hasMaterialChange } from "./diff";

interface Row {
  id: string;
  status: string;
  [key: string]: unknown;
}

describe("diffRows", () => {
  it("reports a baseline when no previous rows exist", () => {
    const diff = diffRows<Row>(null, [{ id: "1", status: "A" }], "id", ["status"]);
    expect(diff.baseline).toBe(true);
    expect(hasMaterialChange(diff)).toBe(false);
  });

  it("detects added, removed, and changed rows", () => {
    const prev: Row[] = [
      { id: "1", status: "A" },
      { id: "2", status: "A" },
    ];
    const curr: Row[] = [
      { id: "2", status: "B" }, // changed
      { id: "3", status: "A" }, // added
      // id "1" removed
    ];
    const diff = diffRows(prev, curr, "id", ["status"]);
    expect(diff.baseline).toBe(false);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].id).toBe("3");
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].id).toBe("1");
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]).toMatchObject({ identifier: "2", field: "status", from: "A", to: "B" });
    expect(hasMaterialChange(diff)).toBe(true);
  });

  it("reports no material change when nothing differs", () => {
    const rows: Row[] = [{ id: "1", status: "A" }];
    const diff = diffRows(rows, rows, "id", ["status"]);
    expect(hasMaterialChange(diff)).toBe(false);
  });
});
