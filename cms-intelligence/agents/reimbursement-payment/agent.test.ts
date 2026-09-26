import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { bottomPickingProvider, inventingProvider, TEST_RATIONALE, withoutGeneratedAt } from "../../intelligence/salience/testProviders";
import { reimbursementPaymentAgent } from "./agent";

const byStem = async (ctx: Parameters<typeof reimbursementPaymentAgent.run>[0]) => {
  const insights = await reimbursementPaymentAgent.run(ctx);
  return { insights, find: (stem: string) => insights.find((i) => i.id.endsWith(stem)) };
};

/** Runs against the real CMS data already committed to this repo. */
describe("reimbursementPaymentAgent", () => {
  it("produces a valid, evidence-backed payment-to-charge benchmark from real claims-vs-payment data", async () => {
    const { find } = await byStem({ modelProvider: null });
    const insight = find("payment-vs-charge-by-provider-type")!;
    expect(() => validateInsight(insight)).not.toThrow();
    expect(insight.magnitude.unit).toBe("percent");
    expect(insight.sourceIds).toContain("cms:medicare-physician-by-provider");
    // States its real scope: every FFS Part B provider, not MA or commercial
    expect(insight.limitations.join(" ")).toMatch(/every Medicare fee-for-service Part B provider/);
    expect(insight.chart?.type).toBe("bar");
  });

  it("reads the fee schedule: conversion factor trend, fee-vs-claims link, and exposure by service and by category", async () => {
    const { insights, find } = await byStem({ modelProvider: null });
    for (const insight of insights) expect(() => validateInsight(insight)).not.toThrow();

    const cf = find("conversion-factor-trend")!;
    expect(cf.questionId).toBe("Q026");
    expect(cf.headline).toMatch(/\$33\.4009 for 2026/);
    expect(cf.sourceIds).toEqual(["cms:physician-fee-schedule"]);

    const lead = find("fee-schedule-leading-indicator")!;
    expect(lead.questionId).toBe("Q034");
    expect(lead.sourceIds).toEqual(["cms:physician-fee-schedule", "cms:medicare-physician-by-service"]);
    expect(lead.magnitude.value).toBeGreaterThan(50); // price moves and claims agree more often than not

    const procedures = find("procedure-fee-exposure")!;
    expect(procedures.questionId).toBe("Q028");
    if (procedures.chart?.type !== "bar") throw new Error("expected a bar chart");
    // Codes only on the chart - never the RVU file's CPT descriptions.
    for (const bar of procedures.chart.bars) expect(bar.label).toMatch(/^[0-9A-Z]{5}$/);

    const categories = find("fee-change-by-category")!;
    expect(categories.questionId).toBe("Q035");
    expect(categories.limitations.join(" ")).toMatch(/not by specialty/);
  });

  it("reads hospital penalty programs: facility exposure and state pressure", async () => {
    const { find } = await byStem({ modelProvider: null });
    const facility = find("hospital-penalty-exposure")!;
    expect(facility.questionId).toBe("Q029");
    expect(facility.period).toEqual({ start: "2025-10-01", end: "2026-09-30" });
    expect(facility.magnitude.value).toBeGreaterThan(0);
    expect(facility.magnitude.value).toBeLessThan(100);

    const states = find("hospital-penalty-by-state")!;
    expect(states.questionId).toBe("Q030");
    expect(states.geography.level).toBe("state");
    if (states.chart?.type !== "bar") throw new Error("expected a bar chart");
    expect(states.chart.bars[0].value).toBeLessThan(0);
  });

  it("with a model configured, charts only real candidates the model picked, while the 'most payment' claim still comes from the full real ranking", async () => {
    const { find: baselineFind } = await byStem({ modelProvider: null });
    const baseline = baselineFind("payment-vs-charge-by-provider-type")!;
    const provider = bottomPickingProvider();
    const { find } = await byStem({ modelProvider: provider });
    const insight = find("payment-vs-charge-by-provider-type")!;

    expect(provider.prompts).toHaveLength(3);
    expect(() => validateInsight(insight)).not.toThrow();
    if (insight.chart?.type !== "bar" || baseline.chart?.type !== "bar") throw new Error("expected bar charts");
    const labels = insight.chart.bars.map((b) => b.label);
    expect(labels).not.toEqual(baseline.chart.bars.map((b) => b.label));
    for (const label of labels) expect(provider.prompts[0]).toContain(`id="${label}"`);

    expect(insight.headline).toMatch(/selected as most noteworthy/);
    expect(insight.headline.split("—")[1]).toBe(baseline.headline.split("—")[1]);
    expect(insight.magnitude).toEqual(baseline.magnitude);
    expect(insight.drivers[0].description).toContain(TEST_RATIONALE);

    // The fee-exposure and state-pressure headlines come from the full ranking, whatever the model shows.
    for (const stem of ["procedure-fee-exposure", "hospital-penalty-by-state"]) {
      expect(find(stem)!.headline).toBe(baselineFind(stem)!.headline);
      expect(find(stem)!.drivers[0].description).toContain(TEST_RATIONALE);
    }
  });

  it("falls back to its exact no-model output when the model invents a candidate", async () => {
    const baseline = await reimbursementPaymentAgent.run({ modelProvider: null });
    const insights = await reimbursementPaymentAgent.run({ modelProvider: inventingProvider() });
    expect(withoutGeneratedAt(insights)).toEqual(withoutGeneratedAt(baseline));
  });
});
