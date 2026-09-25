import { describe, expect, it } from "vitest";
import { buildPlanMap, createRateSummarizer, loadAllPlanYears, parseDollars } from "./marketplaceRatePuf";

const PLAN_HEADER = [
  "StateCode",
  "IssuerId",
  "MarketCoverage",
  "DentalOnlyPlan",
  "StandardComponentId",
  "PlanType",
  "MetalLevel",
  "CSRVariationType",
  "MedicalDrugDeductiblesIntegrated",
  "TEHBDedInnTier1Individual",
  "TEHBInnTier1IndividualMOOP",
  "MEHBDedInnTier1Individual",
  "MEHBInnTier1IndividualMOOP",
];
const plan = (id: string, metal: string, variant: string, opts: { market?: string; dental?: string; ded?: string } = {}) => [
  "FL",
  id.slice(0, 5),
  opts.market ?? "Individual",
  opts.dental ?? "No",
  id,
  "HMO",
  metal,
  variant,
  "Yes",
  opts.ded ?? "$5,000 ",
  "$9,000",
  "",
  "",
];

const planMap = buildPlanMap([
  PLAN_HEADER,
  plan("11111FL0010001", "Silver", "Standard Silver On Exchange Plan", { ded: "$4,500 " }),
  plan("11111FL0010001", "Silver", "Zero Cost Sharing Plan Variation", { ded: "$0" }),
  plan("22222FL0010001", "Silver", "Standard Silver On Exchange Plan"),
  plan("33333FL0010001", "Silver", "Standard Silver On Exchange Plan"),
  plan("22222FL0020001", "Expanded Bronze", "Standard Bronze On Exchange Plan"),
  plan("44444FL0010001", "Low", "Standard Low On Exchange Plan", { dental: "Yes" }),
  plan("55555FL0010001", "Silver", "Standard Silver On Exchange Plan", { market: "SHOP (Small Group)" }),
  plan("66666FL0010001", "Silver", "Standard Silver Off Exchange Plan"),
]);

describe("buildPlanMap", () => {
  it("keeps only on-exchange individual medical plans, with the standard variant's deductible", () => {
    expect([...planMap.keys()].sort()).toEqual(["11111FL0010001", "22222FL0010001", "22222FL0020001", "33333FL0010001"]);
    expect(planMap.get("11111FL0010001")?.deductible).toBe(4500); // not the $0 cost-sharing variant
    expect(planMap.get("11111FL0010001")?.moop).toBe(9000);
  });
});

describe("parseDollars", () => {
  it("reads CMS's dollar text and rejects non-amounts", () => {
    expect(parseDollars("$4,500 ")).toBe(4500);
    expect(parseDollars("$4500 per person")).toBe(4500);
    expect(parseDollars("Not Applicable")).toBeNull();
    expect(parseDollars("")).toBeNull();
  });
});

describe("createRateSummarizer", () => {
  it("takes the second-lowest silver as the benchmark and ignores dental, other ages, later effective dates and implausible rates", () => {
    const s = createRateSummarizer(2026, planMap);
    const line = (planId: string, age: string, rate: string, effective = "2026-01-01", tobacco = "No Preference") =>
      `2026,FL,${planId.slice(0, 5)},HIOS,2025-10-15,${effective},2026-12-31,${planId},Rating Area 1,${tobacco},${age},${rate},`;
    s.addLine("BusinessYear,StateCode,IssuerId,SourceName,ImportDate,RateEffectiveDate,RateExpirationDate,PlanId,RatingAreaId,Tobacco,Age,IndividualRate,IndividualTobaccoRate");
    s.addLine(line("11111FL0010001", "40", "500"));
    s.addLine(line("22222FL0010001", "40", "450", "2026-01-01", "Tobacco User/Non-Tobacco User")); // tobacco-rated plans count
    s.addLine(line("33333FL0010001", "40", "620"));
    s.addLine(line("22222FL0020001", "40", "380"));
    s.addLine(line("44444FL0010001", "40", "30")); // dental
    s.addLine(line("33333FL0010001", "21", "300")); // other age
    s.addLine(line("33333FL0010001", "40", "100", "2026-04-01")); // quarterly rate
    s.addLine('"2026","FL","11111","HIOS","x","2026-01-01","2026-12-31","11111FL0010001","Rating Area 2","No Preference","40","9999",""'); // quoted, implausible
    const year = s.summarize([]);
    const area = year.ratingAreas.find((a) => a.area === "Rating Area 1")!;
    expect(area.benchmark).toBe(500);
    expect(area.lowestBronze).toBe(380);
    expect(area.issuers).toBe(3);
    expect(year.counts.implausibleRates).toBe(1);
    expect(year.states[0].issuerIds).toEqual(["11111", "22222", "33333"]);
    expect(year.states[0].silverDeductibleMedian).toBe(5000);
  });

  it("fails rather than misreading data when many lines have the wrong field count", () => {
    const s = createRateSummarizer(2026, planMap);
    s.addLine("StateCode,PlanId,RatingAreaId,Age,IndividualRate,RateEffectiveDate");
    for (let i = 0; i < 10; i++) s.addLine("FL,x,Rating Area 1,40,1,2026-01-01,extra");
    expect(() => s.summarize([])).toThrow(/wrong field count/);
  });
});

describe("committed plan-year summaries", () => {
  it("cover every plan year from 2014 with no dental-level premiums", () => {
    const years = loadAllPlanYears();
    expect(years[0].planYear).toBe(2014);
    expect(years.length).toBeGreaterThanOrEqual(13);
    for (const y of years) {
      expect(y.states.length).toBeGreaterThanOrEqual(25);
      for (const st of y.states) if (st.benchmarkMedian !== null) expect(st.benchmarkMedian).toBeGreaterThan(100);
    }
  });
});
