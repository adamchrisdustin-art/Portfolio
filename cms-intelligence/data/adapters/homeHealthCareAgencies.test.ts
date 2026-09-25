import { describe, expect, it } from "vitest";
import { parseNumericCell } from "./homeHealthCareAgencies";

describe("parseNumericCell", () => {
  it("reads counts written with thousands separators", () => {
    expect(parseNumericCell("1,608")).toBe(1608);
    expect(parseNumericCell("11,916")).toBe(11916);
  });

  it("reads plain numbers and decimals", () => {
    expect(parseNumericCell("330")).toBe(330);
    expect(parseNumericCell("0.97")).toBe(0.97);
  });

  it("treats blank, '-' and non-string cells as missing, never as 0", () => {
    expect(parseNumericCell("")).toBeNaN();
    expect(parseNumericCell("-")).toBeNaN();
    expect(parseNumericCell(undefined)).toBeNaN();
  });
});
