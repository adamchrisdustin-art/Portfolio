import { describe, expect, it } from "vitest";
import { loadAllOepYears, parseCell, parseStateCsv, stateRows, totalRow, valueOf } from "./marketplaceEnrollment";

const STATES = ["AK","AL","AR","AZ","CA","CO","CT","DC","DE","FL","GA","HI","IA","ID","IL","IN","KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY"];

describe("parseCell", () => {
  it("reads CMS's formatted numbers and treats suppression markers as missing, never zero", () => {
    expect(parseCell('22,903')).toBe(22903);
    expect(parseCell("$1,043 ")).toBe(1043);
    expect(parseCell("*")).toBeNull();
    expect(parseCell("+")).toBeNull();
    expect(parseCell("NR")).toBeNull();
    expect(parseCell("")).toBeNull();
  });
});

describe("parseStateCsv", () => {
  it("parses every state, normalizes the SBM label to SBE, and keeps totals separate", () => {
    const lines = [
      "﻿State_Abrvtn,Pltfrm,Cnsmr,Avg_Prm",
      ...STATES.map((s) => `${s},${s === "CA" ? "SBM" : "HC.gov"},"1,000",$500 `),
      'Total,SBM,NR,NR',
      'Total,All,"51,000",NR',
      ",,,",
    ];
    const year = parseStateCsv(lines.join("\r\n"), 2023, "u");
    expect(stateRows(year)).toHaveLength(51);
    expect(stateRows(year).find((r) => r.state === "CA")?.platform).toBe("SBE");
    expect(valueOf(year, totalRow(year, "SBE")!, "Cnsmr")).toBeNull();
    expect(valueOf(year, totalRow(year, "All")!, "Cnsmr")).toBe(51000);
    expect(year.suppressedCells).toBe(3);
  });

  it("fails rather than silently dropping states", () => {
    expect(() => parseStateCsv("State_Abrvtn,Pltfrm,Cnsmr\nAK,HC.gov,1\n", 2023, "u")).toThrow(/expected 51/);
  });
});

describe("committed open enrollment years", () => {
  it("cover every state and DC from 2020, and state rows sum to the national total", () => {
    const years = loadAllOepYears();
    expect(years[0].planYear).toBe(2020);
    for (const y of years) {
      expect(stateRows(y).map((r) => r.state).sort()).toEqual(STATES);
      const sum = stateRows(y).reduce((n, r) => n + (valueOf(y, r, "Cnsmr") ?? 0), 0);
      expect(sum).toBe(valueOf(y, totalRow(y, "All")!, "Cnsmr"));
    }
  });
});
