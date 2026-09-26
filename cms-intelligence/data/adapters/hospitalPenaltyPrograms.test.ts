import { describe, expect, it } from "vitest";
import { combinedAdjustment } from "../../agents/reimbursement-payment/hospitalPenaltyInsights";
import { combinePrograms, loadLatestPenaltyYear, parseFactorTable } from "./hospitalPenaltyPrograms";

describe("parseFactorTable", () => {
  it("reads CCN<TAB>factor rows, including a bare 1 for no cut, and skips titles and footnotes", () => {
    const text = [
      "Table 15: FY 2026 Hospital Readmissions\t",
      "Hospital CMS Certification Number (CCN)\tFY 2026 Payment Adjustment Factor ",
      "010001\t0.9988",
      "010022\t1",
      "670309\t1.0158592499\t",
      '"*Maryland hospitals are not included"\t',
      "End of worksheet\t",
    ].join("\r\n");
    expect([...parseFactorTable(text)]).toEqual([
      ["010001", 0.9988],
      ["010022", 1],
      ["670309", 1.0158592499],
    ]);
  });
});

describe("combinePrograms", () => {
  it("joins the three programs and both factor tables by CCN, leaving unscored values null", () => {
    const [row] = combinePrograms({
      hrrp: [
        { facility_id: "010001", state: "AL", measure_name: "READM-30-HF-HRRP", excess_readmission_ratio: "1.0233" },
        { facility_id: "010001", state: "AL", measure_name: "READM-30-CABG-HRRP", excess_readmission_ratio: "N/A" },
      ],
      hac: [{ facility_id: "010001", state: "AL", fiscal_year: "2026", total_hac_score: "-0.3384", payment_reduction: "Yes" }],
      hvbp: [{ facility_id: "010001", state: "AL", total_performance_score: "32.1667" }],
      hrrpFactors: new Map([["010001", 0.9988]]),
      hvbpFactors: new Map([["010001", 1.0021]]),
    });
    expect(row).toEqual({
      ccn: "010001",
      state: "AL",
      readmissionRatios: { HF: 1.0233 },
      hacScore: -0.3384,
      hacPenalty: true,
      hvbpTotalPerformanceScore: 32.1667,
      hrrpFactor: 0.9988,
      hvbpFactor: 1.0021,
    });
    expect(combinedAdjustment(row)).toBeCloseTo(0.9988 * 1.0021 * 0.99, 10);
  });
});

describe("committed penalty data", () => {
  it("has FY2026 factors for the programs' hospitals", () => {
    const year = loadLatestPenaltyYear()!;
    expect(year.fiscalYear).toBeGreaterThanOrEqual(2026);
    expect(year.hospitals.filter((h) => h.hrrpFactor !== null).length).toBeGreaterThan(2000);
    expect(year.hospitals.filter((h) => h.hvbpFactor !== null).length).toBeGreaterThan(2000);
    expect(year.hospitals.some((h) => h.hacPenalty === true)).toBe(true);
  });
});
