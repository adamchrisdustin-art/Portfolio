import { describe, expect, it } from "vitest";
import type { FederalRegisterDocument } from "../data/adapters/federalRegisterDocuments";
import type { Insight } from "../intelligence/evidence/schema";
import { buildWatchCalendar, formatWatchDate, shortRuleTitle } from "./watchCalendar";

const doc = (type: string, publicationDate: string, title: string, extra: Partial<FederalRegisterDocument> = {}): FederalRegisterDocument =>
  ({ type, publicationDate, title, documentNumber: title, htmlUrl: "", effectiveOn: null, commentsCloseOn: null, ...extra }) as FederalRegisterDocument;

const insight = (id: string, sourceId: string, end: string): Insight =>
  ({ id, sourceIds: [sourceId], period: { start: end, end } }) as unknown as Insight;

const PFS = (year: number) => `Medicare and Medicaid Programs; CY ${year} Payment Policies Under the Physician Fee Schedule and Other Changes`;
const now = new Date("2026-09-25T20:00:00Z");

describe("buildWatchCalendar", () => {
  const calendar = buildWatchCalendar({
    now,
    unchangedSince: { "cms:hospital-general-information": "2026-09-16" },
    insights: [
      insight("sig-ma-partd-2026-09-ma-enrollment-trend", "cms:ma-part-d-enrollment", "2026-09-01"),
      insight("sig-medicaid-2026-06-enrollment-trend", "cms:medicaid-state-enrollment", "2026-06-30"),
      insight("sig-marketplace-2026-benchmark-trend", "cms:marketplace-rate-puf", "2026-12-31"),
      insight("sig-claims-cost-2024-physician-payment-trend", "cms:medicare-physician-by-provider", "2024-12-31"),
      insight("sig-policy-2026-09-25-upcoming-effective", "federal-register:cms-documents", "2027-06-16"),
    ],
    ruleDocuments: [
      doc("Rule", "2026-08-01", "Medicare Program; FY 2027 IPPS", { effectiveOn: "2026-10-01" }),
      doc("Rule", "2026-08-02", "Medicare Program; FY 2027 Hospice", { effectiveOn: "2026-10-01" }),
      doc("Rule", "2025-08-01", "Medicare Program; FY 2026 IPPS", { effectiveOn: "2025-10-01" }),
      doc("Proposed Rule", "2026-09-01", "Request for Information; Part D", { commentsCloseOn: "2026-11-23" }),
      doc("Proposed Rule", "2025-07-16", PFS(2026)),
      doc("Rule", "2025-11-05", PFS(2026)),
      doc("Proposed Rule", "2026-07-16", PFS(2027)),
    ],
  });
  const find = (title: RegExp) => calendar.find((i) => title.test(i.title));

  it("groups rules taking effect on the same day and skips ones already in effect", () => {
    const oct1 = find(/finalized CMS rules take effect/)!;
    expect(oct1).toMatchObject({ date: "2026-10-01", kind: "scheduled" });
    expect(oct1.detail).toBe("FY 2027 IPPS; FY 2027 Hospice");
    expect(oct1.insightIds).toEqual(["sig-policy-2026-09-25-upcoming-effective"]);
    expect(calendar.some((i) => i.detail.includes("FY 2026"))).toBe(false);
  });

  it("times a pending final payment rule from last year's proposal-to-final gap", () => {
    expect(find(/Final Physician Fee Schedule rule/)).toMatchObject({ date: "2026-11-01", kind: "expected" });
  });

  it("dates data releases from each source's own timing", () => {
    expect(find(/Monthly data refresh/)?.date).toBe("2026-10-01");
    expect(find(/July 2026 Medicaid/)?.date).toBe("2026-10-01");
    expect(find(/January 2027 Medicare Advantage/)?.date).toBe("2027-01-01");
    expect(find(/Plan year 2027 Marketplace/)?.date).toBe("2026-10-01");
    expect(find(/open enrollment for 2027 begins/)?.date).toBe("2026-11-01");
    expect(find(/2025 Medicare physician/)?.date).toBe("2027-05-01");
    expect(find(/quarterly refresh of hospital/)?.date).toBe("2026-12-01");
    expect(find(/Comment period closes/)?.date).toBe("2026-11-23");
  });

  it("lists soonest first", () => {
    const dates = calendar.map((i) => i.date);
    expect(dates).toEqual([...dates].sort());
  });
});

describe("formatting", () => {
  it("marks expected months with ~ and gives scheduled items a day", () => {
    expect(formatWatchDate({ date: "2026-11-01", kind: "expected", title: "", detail: "", insightIds: [] })).toBe("~Nov 2026");
    expect(formatWatchDate({ date: "2026-10-01", kind: "scheduled", title: "", detail: "", insightIds: [] })).toBe("Oct 1, 2026");
  });

  it("shortens Federal Register titles", () => {
    expect(shortRuleTitle("Medicare Program; FY 2027 Hospice Wage Index")).toBe("FY 2027 Hospice Wage Index");
    expect(shortRuleTitle("Medicare and Medicaid Programs: CY 2027 OPPS")).toBe("CY 2027 OPPS");
    expect(shortRuleTitle("x".repeat(120))).toHaveLength(90);
  });
});
