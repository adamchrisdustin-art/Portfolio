import { describe, expect, it } from "vitest";
import { validateInsight } from "../../intelligence/evidence/validate";
import { buildOwnershipInsights } from "./ownershipInsights";

/** Runs against real committed data: change of ownership, All Owners, Provider of Services and Hospital General Information. */
describe("ownership insights", () => {
  it("returns hospital changes, SNF changes by state and private equity owners, all valid", async () => {
    const insights = await buildOwnershipInsights({ modelProvider: null });
    expect(insights.map((i) => i.id.replace(/^sig-provider-network-\d{4}-\d{2}-\d{2}-/, ""))).toEqual(["hospital-ownership-changes", "snf-ownership-changes-by-state", "private-equity-owners"]);
    for (const insight of insights) expect(() => validateInsight(insight)).not.toThrow();
  });

  it("compares the latest year only at the same reporting lag, and keeps still-filling years out of the series", async () => {
    const [hospital] = await buildOwnershipInsights({ modelProvider: null });
    expect(hospital.magnitude.comparedTo).toMatch(/as reported in \d{4}-Q\d/);
    const lastSeriesYear = Number(hospital.series!.points.at(-1)!.date.slice(0, 4));
    expect(lastSeriesYear).toBeLessThanOrEqual(Number(hospital.period.end.slice(0, 4)) - 2);
  });

  it("frames the star-rating cross-check as a description of which hospitals changed hands, not an effect", async () => {
    const [hospital] = await buildOwnershipInsights({ modelProvider: null });
    const star = hospital.drivers.find((d) => /star/.test(d.description));
    expect(star?.relationship).toBe("correlation");
    expect(star?.description).toMatch(/not an effect of the change/);
    expect(hospital.sourceIds).toContain("cms:hospital-general-information");
  });

  it("never names a private equity owner without an organization name, and says when growth is late reporting", async () => {
    const insights = await buildOwnershipInsights({ modelProvider: null });
    const pe = insights.find((i) => i.id.endsWith("private-equity-owners"))!;
    if (pe.chart?.type !== "bar") throw new Error("expected a bar chart");
    for (const bar of pe.chart.bars) expect(bar.label).not.toMatch(/^\s*\(/);
    expect(pe.limitations.join(" ")).toMatch(/self-reported|report their own/);
    expect(pe.period.end).toMatch(/-(28|29|30|31)$/);
  });
});
