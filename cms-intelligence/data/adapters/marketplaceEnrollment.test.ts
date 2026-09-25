import { describe, expect, it } from "vitest";
import { loadAllOepYears, parseCell, parseStateCsv, parseStateWorkbook, stateRows, totalRow, valueOf } from "./marketplaceEnrollment";
import { buildWorkbook } from "./xlsxTestWorkbook";

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
  it("cover every state and DC from 2017, and state rows sum to the national total", () => {
    const years = loadAllOepYears();
    expect(years[0].planYear).toBe(2017);
    for (const y of years) {
      expect(stateRows(y).map((r) => r.state).sort()).toEqual(STATES);
      const sum = stateRows(y).reduce((n, r) => n + (valueOf(y, r, "Cnsmr") ?? 0), 0);
      expect(sum).toBe(valueOf(y, totalRow(y, "All")!, "Cnsmr"));
    }
  });
});

describe("parseStateWorkbook", () => {
  // Same layout as CMS's 2018 workbook: states, then platform totals including the SBE-FP subset, then footnotes.
  const workbook = () =>
    buildWorkbook({
      Methods: [["About this file"]],
      "(2) Enrollment Status": [
        ["State Name", "State Abbr.", "Platform", "Total Number of Consumers Who Have Selected an Exchange Plan", "New Consumers", "Total Re-enrollees", "Active Re-enrollees", "Automatic Re-enrollees"],
        ...STATES.map((s) => [`${s} name`, s, s === "CA" ? "SBM" : "HC.gov", 1000, 300, 700, 400, 300]),
        ["Total", "Total", "HC.gov Platform", 50000, 15000, 35000, 20000, 15000],
        ["Total", "Total", "SBE-FPs†", 4000, 1200, 2800, 1600, 1200],
        ["Total", "Total", "SBE", 1000, 300, 700, "NR", "NR"],
        ["Total", "Total", "All Platforms", 51000, 15300, 35700, "NR", "NR"],
        ["† SBE-FPs include Arkansas, Kentucky, New Mexico, Nevada and Oregon and are a subset of HC.gov states"],
      ],
      "(5) by Premium and FA": [
        ["State Name", "State Abbr.", "Platform", "Total Number of Consumers Who Have Selected an Exchange Plan", "Average Premium  ", "Average Premium after APTC  ", "Consumers with CSR"],
        ...STATES.map((s) => [`${s} name`, s, s === "CA" ? "SBM" : "HC.gov", 1000, s === "CA" ? "NR" : 612.36566505, 142.98752959999999, 10]),
        ["Total", "Total", "All Platforms", 51000, "NR", "NR", "NR"],
      ],
    });

  it("maps the report tabs onto the 2020+ column names, one row per state and platform total", () => {
    const year = parseStateWorkbook(workbook(), 2018, "u");
    expect(year.columns).toEqual(["Cnsmr", "New_Cnsmr", "Tot_Renrl", "Actv_Renrl", "Auto_Renrl", "Avg_Prm", "Avg_Prm_Aftr_APTC"]);
    expect(stateRows(year)).toHaveLength(51);
    const ak = stateRows(year).find((r) => r.state === "AK")!;
    expect(valueOf(year, ak, "Cnsmr")).toBe(1000);
    expect(valueOf(year, ak, "New_Cnsmr")).toBe(300);
    expect(valueOf(year, ak, "Avg_Prm")).toBe(612.37);
    expect(valueOf(year, ak, "Avg_Prm_Aftr_APTC")).toBe(142.99);
  });

  it("normalizes SBM to SBE, keeps HC.gov/SBE/All totals and drops the SBE-FP subset", () => {
    const year = parseStateWorkbook(workbook(), 2018, "u");
    expect(stateRows(year).find((r) => r.state === "CA")?.platform).toBe("SBE");
    expect(year.rows.filter((r) => r.state === "Total").map((r) => r.platform)).toEqual(["HC.gov", "SBE", "All"]);
    expect(valueOf(year, totalRow(year, "HC.gov")!, "Cnsmr")).toBe(50000);
    expect(valueOf(year, totalRow(year, "All")!, "Cnsmr")).toBe(51000);
  });

  it("stores NR as missing, never zero, and counts it", () => {
    const year = parseStateWorkbook(workbook(), 2018, "u");
    expect(valueOf(year, stateRows(year).find((r) => r.state === "CA")!, "Avg_Prm")).toBeNull();
    expect(valueOf(year, totalRow(year, "All")!, "Actv_Renrl")).toBeNull();
    expect(year.suppressedCells).toBe(7);
  });

  it("fails loudly when a tab or column it needs is missing", () => {
    expect(() => parseStateWorkbook(buildWorkbook({ Methods: [["x"]] }), 2018, "u")).toThrow("has no (2) tab");
  });
});

describe("the committed 2017-2019 workbook years", () => {
  it("state rows add up exactly to CMS's published platform totals", () => {
    const years = loadAllOepYears().filter((y) => y.planYear >= 2017 && y.planYear <= 2019);
    expect(years.map((y) => y.planYear)).toEqual([2017, 2018, 2019]);
    for (const year of years) {
      const sum = (platform?: string) => stateRows(year).filter((r) => !platform || r.platform === platform).reduce((s, r) => s + (valueOf(year, r, "Cnsmr") ?? 0), 0);
      expect(sum("HC.gov")).toBe(valueOf(year, totalRow(year, "HC.gov")!, "Cnsmr"));
      expect(sum("SBE")).toBe(valueOf(year, totalRow(year, "SBE")!, "Cnsmr"));
      expect(sum()).toBe(valueOf(year, totalRow(year, "All")!, "Cnsmr"));
    }
  });
});
