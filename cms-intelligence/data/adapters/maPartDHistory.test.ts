import { describe, expect, it } from "vitest";
import type { MaPartDPlanRow } from "./maPartDEnrollment";
import { segmentOf, summarizeMonth } from "./maPartDHistory";

const row = (overrides: Partial<MaPartDPlanRow>): MaPartDPlanRow => ({
  organizationType: "Local CCP",
  planType: "HMO",
  offersPartD: "Yes",
  enrollment: 100,
  parentOrganization: "Carrier A",
  organizationMarketingName: "A",
  ...overrides,
});

describe("segmentOf", () => {
  it("separates Medicare Advantage, standalone Part D and other plans by CMS organization type", () => {
    expect(segmentOf("Local CCP")).toBe("ma");
    expect(segmentOf("Regional CCP")).toBe("ma");
    expect(segmentOf("PDP")).toBe("pdp");
    expect(segmentOf("Employer/Union Only Direct Contract PDP")).toBe("pdp");
    expect(segmentOf("1876 Cost")).toBe("other");
    expect(segmentOf("National PACE")).toBe("other");
  });
});

describe("summarizeMonth", () => {
  const summary = summarizeMonth(
    [
      row({}),
      row({ offersPartD: "No", enrollment: 50, planType: "Local PPO" }),
      row({ organizationType: "PDP", planType: "Medicare Prescription Drug Plan", enrollment: 300 }),
      row({ organizationType: "1876 Cost", planType: "1876 Cost", enrollment: 20, parentOrganization: "Carrier B" }),
    ],
    "2026-09",
    "https://example.test/zip",
    7
  );

  it("totals each segment separately", () => {
    expect(summary.totals).toEqual({ ma: 150, pdp: 300, other: 20 });
    expect(summary.maWithPartD).toBe(100);
    expect(summary.suppressedRowCount).toBe(7);
  });

  it("keeps MA and PDP apart within each parent organization", () => {
    expect(summary.byParentOrganization[0]).toEqual({ parentOrganization: "Carrier A", plans: 3, ma: 150, pdp: 300, other: 0 });
    expect(summary.byPlanType.find((t) => t.planType === "Local PPO")?.ma).toBe(50);
  });
});
