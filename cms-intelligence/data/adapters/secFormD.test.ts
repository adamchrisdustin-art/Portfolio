import { describe, expect, it } from "vitest";
import { foldAmendments, joinQuarter, loadLatestSnapshot, parseFilingDate, parseIndexLinks, parseTsv, quarterBounds, type FormDFiling } from "./secFormD";

describe("parseIndexLinks", () => {
  it("finds every quarter's zip under either path, newest first", () => {
    const html = `
      <a href="/files/datastandardsinnovation/data/form-d-data-sets/2026q2_d.zip">2026 Q2</a>
      <a href="/files/structureddata/data/form-d-data-sets/2026q1_d.zip">2026 Q1</a>
      <a href="/files/structureddata/data/form-d-data-sets/2025q4_d.zip">2025 Q4</a>`;
    expect(parseIndexLinks(html)).toEqual([
      { quarter: "2026Q2", url: "https://www.sec.gov/files/datastandardsinnovation/data/form-d-data-sets/2026q2_d.zip" },
      { quarter: "2026Q1", url: "https://www.sec.gov/files/structureddata/data/form-d-data-sets/2026q1_d.zip" },
      { quarter: "2025Q4", url: "https://www.sec.gov/files/structureddata/data/form-d-data-sets/2025q4_d.zip" },
    ]);
  });
});

describe("dates", () => {
  it("parses Form D filing dates and quarter bounds", () => {
    expect(parseFilingDate("30-JUN-2026")).toBe("2026-06-30");
    expect(parseFilingDate("2026-06-30")).toBeNull();
    expect(quarterBounds("2024Q3")).toEqual({ start: "2024-07-01", end: "2024-09-30" });
    expect(quarterBounds("2026Q1")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
  });
});

describe("parseTsv and joinQuarter", () => {
  const submissions = parseTsv(
    [
      "ACCESSIONNUMBER\tFILE_NUM\tFILING_DATE\tSUBMISSIONTYPE\tTESTORLIVE",
      "A1\t021-1\t14-APR-2026\tD\tLIVE",
      "A2\t021-2\t15-APR-2026\tD\tLIVE",
      "A3\t021-3\t16-APR-2026\tD\tTEST",
    ].join("\r\n")
  );
  const offerings = parseTsv(
    [
      "ACCESSIONNUMBER\tINDUSTRYGROUPTYPE\tISAMENDMENT\tPREVIOUSACCESSIONNUMBER\tTOTALOFFERINGAMOUNT\tTOTALAMOUNTSOLD",
      "A1\tBiotechnology\tfalse\t\tIndefinite\t5000000",
      "A2\tPooled Investment Fund\tfalse\t\t100\t100",
      "A3\tBiotechnology\tfalse\t\t100\t100",
      "BAD\trow",
    ].join("\r\n")
  );
  const issuers = parseTsv(["ACCESSIONNUMBER\tIS_PRIMARYISSUER_FLAG\tCIK\tENTITYNAME\tSTATEORCOUNTRY\tSTATEORCOUNTRYDESCRIPTION", "A1\tYES\t0000012345\tExample Bio, Inc.\tCA\tCALIFORNIA"].join("\r\n"));

  it("keeps live health-care filings only, with Indefinite amounts as missing", () => {
    expect(joinQuarter("2026Q2", submissions, offerings, issuers)).toEqual([
      {
        accessionNumber: "A1",
        type: "D",
        previousAccessionNumber: "",
        filingDate: "2026-04-14",
        quarter: "2026Q2",
        industry: "Biotechnology",
        amountSold: 5000000,
        offeringAmount: null,
        entity: "Example Bio, Inc.",
        cik: "12345",
        state: "CALIFORNIA",
      },
    ]);
  });
});

describe("foldAmendments", () => {
  const filing = (accessionNumber: string, type: "D" | "D/A", previousAccessionNumber: string, filingDate: string, amountSold: number): FormDFiling => ({
    accessionNumber,
    type,
    previousAccessionNumber,
    filingDate,
    quarter: `${filingDate.slice(0, 4)}Q${Math.ceil(Number(filingDate.slice(5, 7)) / 3)}`,
    industry: "Biotechnology",
    amountSold,
    offeringAmount: null,
    entity: "Example Bio, Inc.",
    cik: "12345",
    state: "CALIFORNIA",
  });

  it("counts an offering once, in its first notice's quarter, at its latest amendment's amount sold", () => {
    const { offerings, amendmentsFolded, amendmentsToEarlierOfferings } = foldAmendments([
      filing("D1", "D", "", "2025-01-10", 1_000_000),
      filing("A1", "D/A", "D1", "2025-06-10", 3_000_000),
      filing("A2", "D/A", "A1", "2026-01-10", 4_000_000), // chains through an earlier amendment
    ]);
    expect(offerings).toHaveLength(1);
    expect(offerings[0]).toMatchObject({ accessionNumber: "D1", quarter: "2025Q1", amountSold: 4_000_000, amendments: 2 });
    expect(amendmentsFolded).toBe(2);
    expect(amendmentsToEarlierOfferings).toBe(0);
  });

  it("leaves out amendments to offerings first reported before the window", () => {
    const { offerings, amendmentsToEarlierOfferings } = foldAmendments([filing("A9", "D/A", "D-before-window", "2025-02-01", 9_000_000)]);
    expect(offerings).toHaveLength(0);
    expect(amendmentsToEarlierOfferings).toBe(1);
  });
});

describe("the committed snapshot", () => {
  it("holds 8 consecutive quarters and reconciles every health-care filing", () => {
    const snap = loadLatestSnapshot()!;
    expect(snap.quarters).toHaveLength(8);
    const { healthFilings, offerings, amendmentsFolded, amendmentsToEarlierOfferings } = snap.counts;
    expect(healthFilings).toBe(offerings + amendmentsFolded + amendmentsToEarlierOfferings);
    expect(snap.byQuarterIndustry.reduce((s, r) => s + r.offerings, 0)).toBe(offerings);
    expect(snap.topOfferings.length).toBeGreaterThan(10);
  });
});
