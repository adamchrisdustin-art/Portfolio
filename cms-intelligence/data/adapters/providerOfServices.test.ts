import { describe, expect, it } from "vitest";
import {
  annualSeries,
  combinedHistory,
  combineQuarter,
  eventsFor,
  iqiesFacilityType,
  loadAllQuarters,
  normalizePosRow,
  qiesFacilityType,
  quarterOf,
  summarizePosRows,
  unusableQuarters,
  type PosQuarterSummary,
} from "./providerOfServices";

const qiesRow = { PRVDR_NUM: "010001", PRVDR_CTGRY_CD: "01", PRVDR_CTGRY_SBTYP_CD: "01", STATE_CD: "AL", PGM_TRMNTN_CD: "00", TRMNTN_EXPRTN_DT: "", ORGNL_PRTCPTN_DT: "19660701", CRTFD_BED_CNT: "420" };
const iqiesRow = { prvdr_num: "035302", prvdr_type_id: "20", state_cd: "AZ", pgm_trmntn_cd: "00", trmntn_exprtn_dt: "", orgnl_prtcptn_dt: "2021-06-23", crtfd_bed_cnt: "94" };

describe("facility type mapping", () => {
  it("splits QIES hospitals by subtype and maps both files' codes to one set of types", () => {
    expect(qiesFacilityType("01", "01")).toBe("short-term-acute-hospital");
    expect(qiesFacilityType("01", "11")).toBe("critical-access-hospital");
    expect(qiesFacilityType("01", "04")).toBe("other-hospital");
    for (const code of ["02", "03", "04", "10"]) expect(qiesFacilityType(code, "")).toBe("nursing-home");
    expect(iqiesFacilityType("20")).toBe("nursing-home");
    expect(qiesFacilityType("05", "")).toBe(iqiesFacilityType("3"));
    expect(qiesFacilityType("16", "")).toBe(iqiesFacilityType("12"));
    // Types with no stable home across both files are left out rather than jumping when they move.
    expect(qiesFacilityType("19", "")).toBeNull();
    expect(iqiesFacilityType("5")).toBeNull();
  });
});

describe("normalizePosRow", () => {
  it("reads both files into the same shape", () => {
    expect(normalizePosRow(qiesRow, "qies")).toEqual({ ccn: "010001", type: "short-term-acute-hospital", state: "AL", active: true, beds: 420, openedYear: 1966, closedYear: null, terminationCode: "" });
    expect(normalizePosRow(iqiesRow, "iqies")).toMatchObject({ type: "nursing-home", state: "AZ", active: true, beds: 94, openedYear: 2021 });
  });

  it("treats a termination code with a date as a closure, and trims iQIES's padded codes", () => {
    expect(normalizePosRow({ ...qiesRow, PGM_TRMNTN_CD: "01", TRMNTN_EXPRTN_DT: "20010831" }, "qies")).toMatchObject({ active: false, closedYear: 2001, terminationCode: "01" });
    expect(normalizePosRow({ ...iqiesRow, pgm_trmntn_cd: "01 ", trmntn_exprtn_dt: "2023-12-30" }, "iqies")).toMatchObject({ active: false, closedYear: 2023, terminationCode: "01" });
  });

  it("counts a blank code with no termination date as active (the first iQIES quarter), and stores missing beds as null", () => {
    expect(normalizePosRow({ ...iqiesRow, pgm_trmntn_cd: "", crtfd_bed_cnt: "Not Available" }, "iqies")).toMatchObject({ active: true, beds: null });
  });

  it("drops rows with no usable state or type", () => {
    expect(normalizePosRow({ ...qiesRow, STATE_CD: "" }, "qies")).toBeNull();
    expect(normalizePosRow({ ...qiesRow, PRVDR_CTGRY_CD: "22" }, "qies")).toBeNull();
  });
});

describe("summarizePosRows", () => {
  it("counts active facilities and their beds by state and type, and dates openings and closures", () => {
    const rows = [qiesRow, { ...qiesRow, PRVDR_NUM: "010002", CRTFD_BED_CNT: "80", ORGNL_PRTCPTN_DT: "20200115" }, { ...qiesRow, PRVDR_NUM: "010003", PGM_TRMNTN_CD: "01", TRMNTN_EXPRTN_DT: "20250301" }];
    const s = summarizePosRows(rows, { system: "qies", periodStart: "2026-04-01", periodEnd: "2026-06-30", datasetId: "x" });
    expect(s.quarter).toBe("2026-Q2");
    expect(s.byStateType).toEqual([["AL", "short-term-acute-hospital", 3, 2, 500]]);
    expect(s.eventsNational).toEqual([
      { type: "short-term-acute-hospital", year: 2020, openings: 1, closures: 0, closuresByReason: {} },
      { type: "short-term-acute-hospital", year: 2025, openings: 0, closures: 1, closuresByReason: { "01": 1 } },
    ]);
  });
});

const summary = (system: "qies" | "iqies", quarter: string, rows: PosQuarterSummary["byStateType"]): PosQuarterSummary => ({
  dataset: "t",
  system,
  quarter,
  periodStart: "",
  periodEnd: `${quarter.slice(0, 4)}-12-31`,
  datasetId: "",
  rowCount: 0,
  byStateType: rows,
  eventsNational: [],
});

describe("combining the two files", () => {
  it("takes each type from the file that carries it, never summing both", () => {
    const q = combineQuarter(summary("qies", "2025-Q3", [["AL", "short-term-acute-hospital", 5, 4, 400]]), summary("iqies", "2025-Q3", [["AL", "nursing-home", 3, 3, 300]]))!;
    expect(q.types.get("short-term-acute-hospital")).toMatchObject({ providers: 4, beds: 400, system: "qies" });
    expect(q.types.get("nursing-home")).toMatchObject({ providers: 3, beds: 300, system: "iqies" });
    const both = combineQuarter(summary("qies", "2025-Q3", [["AL", "nursing-home", 9, 9, 900]]), summary("iqies", "2025-Q3", [["AL", "nursing-home", 3, 3, 300]]))!;
    expect(both.types.get("nursing-home")).toMatchObject({ providers: 9, system: "qies" });
  });

  it("marks frozen and defective quarters unusable and keeps them out of the annual series", () => {
    const counts: [string, number][] = [["2018-Q4", 100], ["2019-Q4", 102], ["2020-Q1", 90], ["2020-Q2", 103], ["2020-Q4", 104], ["2021-Q4", 104], ["2022-Q4", 106]];
    const history = combinedHistory(counts.map(([q, v]) => summary("qies", q, [["AL", "nursing-home", v, v, v * 10]])));
    expect([...unusableQuarters(history, "nursing-home")]).toEqual(["2020-Q1", "2021-Q4"]);
    expect(annualSeries(history, "nursing-home").map((p) => p.year)).toEqual([2018, 2019, 2020, 2022]);
  });

  it("quarterOf reads a period start", () => {
    expect(quarterOf("2025-07-01")).toBe("2025-Q3");
    expect(quarterOf("2011-10-01")).toBe("2011-Q4");
  });
});

describe("committed summaries", () => {
  const history = combinedHistory(loadAllQuarters());

  it("cover 2011 through the latest quarter, with hospitals from QIES and nursing homes from iQIES after the move", () => {
    expect(history[0].quarter).toBe("2011-Q4");
    const latest = history.at(-1)!;
    expect(latest.types.get("short-term-acute-hospital")?.system).toBe("qies");
    expect(latest.types.get("nursing-home")?.system).toBe("iqies");
    expect(history.find((q) => q.quarter === "2025-Q2")!.types.get("nursing-home")?.system).toBe("qies");
  });

  it("show no jump at the nursing home move bigger than a normal quarter's change", () => {
    const before = history.find((q) => q.quarter === "2025-Q2")!.types.get("nursing-home")!;
    const after = history.find((q) => q.quarter === "2025-Q3")!.types.get("nursing-home")!;
    expect(Math.abs(after.beds / before.beds - 1)).toBeLessThan(0.01);
  });

  it("record openings and closures by year for the same-lag comparison", () => {
    const latest = history.at(-1)!.quarter;
    const year = Number(latest.slice(0, 4)) - 1;
    expect(eventsFor(history, "fqhc", year, latest)?.openings).toBeGreaterThan(0);
  });
});
