import { describe, expect, it } from "vitest";
import {
  companyNameFrom,
  dateRanges,
  echoMatches,
  HEALTH_SICS,
  hitToFiling,
  loadLatestSnapshot,
  parseFormIndex,
  summarize,
  type EftsHit,
  type Health8kFiling,
} from "./secHealthIndustry8k";

const hit = (over: Partial<EftsHit["_source"]> = {}, id = "0001193125-26-397901:d104323d8k.htm"): EftsHit => ({
  _id: id,
  _source: {
    ciks: ["0000070318"],
    display_names: ["TENET HEALTHCARE CORP  (THC)  (CIK 0000070318)"],
    sics: ["8062"],
    items: ["1.01", "2.03", "9.01"],
    form: "8-K",
    file_date: "2026-09-22",
    adsh: "0001193125-26-397901",
    ...over,
  },
});

describe("HEALTH_SICS", () => {
  it("covers the SIC codes checked against SEC's list, without the mixed 6321 and 8731", () => {
    const codes = HEALTH_SICS.map((s) => s.code);
    for (const code of ["2834", "2836", "3841", "3851", "5047", "5122", "5912", "6324", "8062", "8093"]) expect(codes).toContain(code);
    expect(codes).not.toContain("6321");
    expect(codes).not.toContain("8731");
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("dateRanges", () => {
  it("covers the window with no gaps or overlaps, and each SIC's ranges start on different days", () => {
    const a = dateRanges("2024-09-26", "2026-09-26", 0);
    const b = dateRanges("2024-09-26", "2026-09-26", 5);
    for (const ranges of [a, b]) {
      expect(ranges[0][0]).toBe("2024-09-26");
      expect(ranges[ranges.length - 1][1]).toBe("2026-09-26");
      for (let i = 1; i < ranges.length; i++) {
        expect(Date.parse(ranges[i][0]) - Date.parse(ranges[i - 1][1])).toBe(864e5);
      }
    }
    expect(a[0][1]).not.toBe(b[0][1]);
  });
});

describe("echoMatches", () => {
  const body = (sics: string[], gte: string, lte: string, from: number) => ({
    hits: { total: { value: 1, relation: "eq" }, hits: [] },
    query: { from, query: { bool: { filter: [{ terms: { root_forms: ["8-K"] } }, { terms: { sics } }, { range: { file_date: { gte, lte } } }] } } },
  });

  it("accepts the query that was asked for", () => {
    expect(echoMatches(body(["3841"], "2024-09-26", "2024-12-25", 0), "3841", "2024-09-26", "2024-12-25", 0)).toBe(true);
  });

  it("rejects another SIC's cached answer, seen live 2026-09-25", () => {
    expect(echoMatches(body(["5912"], "2024-09-26", "2024-12-25", 0), "3841", "2024-09-26", "2024-12-25", 0)).toBe(false);
    expect(echoMatches(body(["8062", "6324"], "2024-09-26", "2024-12-25", 0), "8062", "2024-09-26", "2024-12-25", 0)).toBe(false);
  });

  it("rejects a different date range or page", () => {
    expect(echoMatches(body(["3841"], "2024-09-26", "2024-12-24", 0), "3841", "2024-09-26", "2024-12-25", 0)).toBe(false);
    expect(echoMatches(body(["3841"], "2024-09-26", "2024-12-25", 100), "3841", "2024-09-26", "2024-12-25", 0)).toBe(false);
  });
});

describe("hitToFiling", () => {
  it("keeps the fields used, with the company name and filing URL", () => {
    expect(hitToFiling(hit(), "8062")).toEqual({
      cik: "70318",
      name: "TENET HEALTHCARE CORP",
      sic: "8062",
      filingDate: "2026-09-22",
      items: ["1.01", "2.03", "9.01"],
      accessionNumber: "0001193125-26-397901",
      url: "https://www.sec.gov/Archives/edgar/data/70318/000119312526397901/d104323d8k.htm",
    });
  });

  it("drops 8-K/A amendments, which restate a filing already counted", () => {
    expect(hitToFiling(hit({ form: "8-K/A" }), "8062")).toBeNull();
  });

  it("attributes a multi-filer 8-K to the first filer with a health SIC", () => {
    const f = hitToFiling(hit({ ciks: ["0000000001", "0000070318"], display_names: ["SOME REIT  (CIK 0000000001)", "TENET HEALTHCARE CORP  (THC)  (CIK 0000070318)"], sics: ["6798", "8062"] }), "8062");
    expect(f?.cik).toBe("70318");
    expect(f?.sic).toBe("8062");
  });
});

describe("companyNameFrom", () => {
  it("strips the ticker and CIK suffixes EDGAR adds", () => {
    expect(companyNameFrom("HCA Healthcare, Inc.  (HCA)  (CIK 0000860730)")).toBe("HCA Healthcare, Inc.");
    expect(companyNameFrom("SOME CO  (ABC, ABC-WT)  (CIK 0000000002)")).toBe("SOME CO");
    expect(companyNameFrom("NO TICKER LLC  (CIK 0000000003)")).toBe("NO TICKER LLC");
  });
});

describe("parseFormIndex", () => {
  it("reads 8-K rows of a daily form index and skips other forms", () => {
    const text = [
      "Form Type   Company Name                                                  CIK         Date Filed  File Name",
      "---------------------------------------------------------------------------------------------------------",
      "1-A-W            Glow Holdings, Inc.                                           1114859     20260922    edgar/data/1114859/0001683168-26-007284.txt",
      "8-K              AYTU BIOPHARMA, INC                                           1385818     20260922    edgar/data/1385818/0001437749-26-030900.txt",
      "8-K/A            SOMEONE ELSE                                                  1           20260922    edgar/data/1/0000000000-26-000001.txt",
    ].join("\n");
    expect(parseFormIndex(text)).toEqual([{ name: "AYTU BIOPHARMA, INC", cik: "1385818" }]);
  });
});

describe("summarize", () => {
  const f = (cik: string, sic: string, filingDate: string, items: string[], n: number): Health8kFiling => ({ cik, name: `Co ${cik}`, sic, filingDate, items, accessionNumber: `acc-${n}`, url: `https://www.sec.gov/x/${n}` });

  it("counts each item once per filing, by SIC and month and by company, and lists Item 2.01 filings newest first", () => {
    const snap = summarize(
      [f("1", "2834", "2026-01-05", ["1.01", "9.01"], 1), f("1", "2834", "2026-01-20", ["2.01", "5.02"], 2), f("2", "8062", "2026-02-01", ["2.01"], 3)],
      { pulledAt: "2026-09-26T00:00:00Z", windowStart: "2024-09-26", windowEnd: "2026-09-26", method: "full-text-search" }
    );
    expect(snap.bySicMonth).toEqual([
      ["2834", "2026-01", 2, 1, 1, 1],
      ["8062", "2026-02", 1, 0, 1, 0],
    ]);
    expect(snap.byCompany).toEqual([
      ["1", 2, 1, 1, 1],
      ["2", 1, 0, 1, 0],
    ]);
    expect(snap.assetDeals.map((d) => d[1])).toEqual(["2026-02-01", "2026-01-20"]);
  });
});

describe("the committed snapshot", () => {
  it("covers a 730-day window and matches the 57 SIC 8062 8-Ks verified for 2026 through 2026-09-25", () => {
    const snap = loadLatestSnapshot()!;
    expect(Date.parse(snap.windowEnd) - Date.parse(snap.windowStart)).toBe(730 * 864e5);
    const hospitals2026 = snap.bySicMonth.filter((r) => r[0] === "8062" && r[1] >= "2026-01" && r[1] <= "2026-09").reduce((s, r) => s + r[2], 0);
    expect(hospitals2026).toBeGreaterThanOrEqual(57);
  });
});
