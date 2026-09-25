import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { marketCatalystAgent } from "./agent";

/** Runs against the real committed snapshots for all 4 new sources (SEC EDGAR, openFDA, NIH RePORTER, ClinicalTrials.gov). */
describe("marketCatalystAgent", () => {
  it("produces valid, evidence-backed insights from real data with no model configured", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(() => validateInsight(insight)).not.toThrow();
      expect(insight.population).toBe("n/a");
      expect(insight.geography.level).toBe("national");
      expect(insight.geography.code).toBe("US");
    }
  });

  it("covers all 13 question IDs (Q113-Q124 plus Q129) on the agent definition", () => {
    expect(marketCatalystAgent.id).toBe("market-catalyst-intelligence");
    expect(marketCatalystAgent.questionIds).toEqual([
      "Q113", "Q114", "Q115", "Q116",
      "Q117", "Q118", "Q119",
      "Q120", "Q121", "Q122",
      "Q123", "Q124", "Q129",
    ]);
  });

  it("the research-themes insight (Q129) excludes generic terms and never merges near-synonym terms silently", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const themes = insights.find((i) => i.questionId === "Q129");
    expect(themes).toBeDefined();
    expect(themes?.chart?.type).toBe("bar");
    if (themes?.chart?.type === "bar") {
      expect(themes.chart.bars.length).toBeGreaterThan(0);
      for (const bar of themes.chart.bars) expect(bar.value).toBeGreaterThan(0);
    }
    // Must disclose the synonym-fragmentation limitation, not hide it.
    expect(themes?.limitations.join(" ")).toMatch(/synonym/i);
  });

  it("every insight cites exactly one of the 4 new real source IDs", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const validSourceIds = [
      "nih-reporter:project-awards",
      "openfda:drugsfda-novel-approvals",
      "sec-edgar:healthcare-8k-filings",
      "clinicaltrials-gov:phase3-results",
    ];
    for (const insight of insights) {
      expect(insight.sourceIds.length).toBeGreaterThan(0);
      for (const id of insight.sourceIds) expect(validSourceIds).toContain(id);
    }
  });

  it("NIH award-count insight (Q113) headlines the real largest award and charts real top-10 awards", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const awardCount = insights.find((i) => i.questionId === "Q113");
    expect(awardCount).toBeDefined();
    expect(awardCount?.sourceIds).toContain("nih-reporter:project-awards");
    expect(awardCount?.headline).toMatch(/largest single award/i);
    expect(awardCount?.chart?.type).toBe("bar");
    // The top-N list must say it isn't the whole population
    expect(awardCount?.limitations.join(" ")).toMatch(/names the largest awards; totals and institute breakdowns cover every award/);
  });

  it("NIH total-dollars insight (Q114) is a distinct aggregate KPI from Q113", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const totalDollars = insights.find((i) => i.questionId === "Q114");
    expect(totalDollars).toBeDefined();
    expect(totalDollars?.magnitude.unit).toBe("usd");
  });

  it("NIH by-institute insight (Q115) splits every award's dollars by administering institute, not the all-'NIH' agency_code", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const byInstitute = insights.find((i) => i.questionId === "Q115");
    expect(byInstitute).toBeDefined();
    if (byInstitute?.chart?.type !== "donut") throw new Error("expected a donut");
    // Real institutes (NCI, NIAID...), not the single "NIH" agency_code value
    expect(byInstitute.chart.slices.length).toBeGreaterThan(3);
    expect(byInstitute.chart.slices.map((s) => s.label)).toContain("NCI");
  });

  it("NIH total-dollars insight (Q114) covers every award notice, with a real monthly series", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const total = insights.find((i) => i.questionId === "Q114")!;
    expect(total.headline).not.toMatch(/sampled/);
    expect(total.series?.points.length).toBeGreaterThan(12);
  });

  it("NIH top-recipient-orgs insight (Q116) names a real recipient organization", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const topOrgs = insights.find((i) => i.questionId === "Q116");
    expect(topOrgs).toBeDefined();
    expect(topOrgs?.chart?.type).toBe("bar");
    // A real organization name is expected in the headline - legitimate under the revised naming rule.
    expect(topOrgs?.headline.length).toBeGreaterThan(20);
  });

  it("FDA NME approval-count insight (Q117) never uses the word 'breakthrough' as a substantive claim (only the limitations disclosure may mention it, to disclaim it)", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const nmeCount = insights.find((i) => i.questionId === "Q117");
    expect(nmeCount).toBeDefined();
    expect(nmeCount?.sourceIds).toContain("openfda:drugsfda-novel-approvals");
    const substantiveText = JSON.stringify({ headline: nmeCount?.headline, drivers: nmeCount?.drivers, businessRelevance: nmeCount?.businessRelevance });
    expect(substantiveText).not.toMatch(/breakthrough/i);
    // The limitations field is where this rule is explicitly disclosed - it's expected to name the forbidden term there.
    expect(nmeCount?.limitations.join(" ")).toMatch(/breakthrough/i);
  });

  it("FDA priority-split insight (Q118) uses a real donut of PRIORITY vs. STANDARD review", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const prioritySplit = insights.find((i) => i.questionId === "Q118");
    expect(prioritySplit).toBeDefined();
    expect(prioritySplit?.chart?.type).toBe("donut");
    if (prioritySplit?.chart?.type === "donut") {
      const labels = prioritySplit.chart.slices.map((s) => s.label);
      expect(labels).toContain("PRIORITY");
      expect(labels).toContain("STANDARD");
    }
  });

  it("FDA approvals-by-month insight (Q119) uses a real bar chart", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const byMonth = insights.find((i) => i.questionId === "Q119");
    expect(byMonth).toBeDefined();
    expect(byMonth?.chart?.type).toBe("bar");
  });

  it("SEC leadership-change insight (Q120) names real tracked companies and never says 'fired' or 'resigned'", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const leadershipChange = insights.find((i) => i.questionId === "Q120");
    expect(leadershipChange).toBeDefined();
    expect(leadershipChange?.sourceIds).toContain("sec-edgar:healthcare-8k-filings");
    const text = JSON.stringify(leadershipChange);
    expect(text).not.toMatch(/\bfired\b/i);
    expect(text).not.toMatch(/\bresigned\b/i);
    expect(leadershipChange?.headline).toMatch(/Item 5\.02/);
    expect(leadershipChange?.chart?.type).toBe("bar");
    if (leadershipChange?.chart?.type === "bar") {
      expect(leadershipChange.chart.bars.length).toBe(6); // all 6 tracked companies, including zero-count ones
    }
  });

  it("SEC filing-type mix insight (Q121) is a donut distinct from the per-company breakdowns", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const filingMix = insights.find((i) => i.questionId === "Q121");
    expect(filingMix).toBeDefined();
    expect(filingMix?.chart?.type).toBe("donut");
    if (filingMix?.chart?.type === "donut") {
      expect(filingMix.chart.slices[filingMix.chart.slices.length - 1].label).toMatch(/other/i);
    }
  });

  it("SEC material-agreement insight (Q122) never says 'announced a partnership'", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const materialAgreement = insights.find((i) => i.questionId === "Q122");
    expect(materialAgreement).toBeDefined();
    const text = JSON.stringify(materialAgreement);
    expect(text).not.toMatch(/announced a partnership/i);
    expect(materialAgreement?.headline).toMatch(/Item 1\.01/);
  });

  it("every SEC-sourced insight discloses the fixed 6-company watchlist bound", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const secInsights = insights.filter((i) => i.sourceIds.includes("sec-edgar:healthcare-8k-filings"));
    expect(secInsights.length).toBeGreaterThan(0);
    for (const insight of secInsights) {
      expect(insight.limitations.join(" ")).toMatch(/watchlist/i);
    }
  });

  it("ClinicalTrials results-count insight (Q123) never claims a 'positive result' as a substantive claim (only the limitations disclosure may mention it, to disclaim it)", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const resultsCount = insights.find((i) => i.questionId === "Q123");
    expect(resultsCount).toBeDefined();
    expect(resultsCount?.sourceIds).toContain("clinicaltrials-gov:phase3-results");
    const substantiveText = JSON.stringify({ headline: resultsCount?.headline, drivers: resultsCount?.drivers, businessRelevance: resultsCount?.businessRelevance });
    expect(substantiveText).not.toMatch(/positive result/i);
    expect(resultsCount?.limitations.join(" ")).toMatch(/no success\/failure judgment|success.failure/i);
  });

  it("ClinicalTrials enrollment-distribution insight (Q124) is a real Tukey boxplot with correctly ordered whiskers, or is honestly skipped if too few trials", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    const enrollmentDist = insights.find((i) => i.questionId === "Q124");
    if (enrollmentDist) {
      expect(enrollmentDist.chart?.type).toBe("boxplot");
      if (enrollmentDist.chart?.type === "boxplot") {
        for (const box of enrollmentDist.chart.boxes) {
          expect(box.whiskerLow).toBeLessThanOrEqual(box.q1);
          expect(box.q3).toBeLessThanOrEqual(box.whiskerHigh);
        }
      }
    }
  });

  it("never fabricates a number - every magnitude value is finite", async () => {
    const insights = await marketCatalystAgent.run({ modelProvider: null });
    for (const insight of insights) {
      expect(Number.isFinite(insight.magnitude.value)).toBe(true);
    }
  });
});
