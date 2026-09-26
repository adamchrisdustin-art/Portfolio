import { describe, expect, it } from "vitest";
import { runFullSweep } from "../agents/orchestrator/fullSweep";
import { formatPeriod, RELATED_GROUPS, relatedFindings, shortHeadline, stakeholdersFor, stemOf } from "./findingPresentation";

describe("formatPeriod", () => {
  it("shows whole years, months or days, whichever the dates carry", () => {
    expect(formatPeriod({ start: "2013-01-01", end: "2024-12-31" })).toBe("2013–2024");
    expect(formatPeriod({ start: "2024-01-01", end: "2024-12-31" })).toBe("2024");
    expect(formatPeriod({ start: "2017-06-01", end: "2026-06-30" })).toBe("Jun 2017–Jun 2026");
    expect(formatPeriod({ start: "2026-09-01", end: "2026-09-01" })).toBe("Sep 2026");
    expect(formatPeriod({ start: "2026-09-16", end: "2026-09-23" })).toBe("Sep 16–23, 2026");
    expect(formatPeriod({ start: "2026-09-25", end: "2026-09-25" })).toBe("Sep 25, 2026");
    expect(formatPeriod({ start: "2024-09-25", end: "2026-09-25" })).toBe("Sep 25, 2024–Sep 25, 2026");
  });
});

describe("stemOf", () => {
  it("drops the prefix and every date part, so the stem survives a monthly refresh", () => {
    expect(stemOf("sig-market-growth-2026-09-23-state-distribution")).toBe("market-growth-state-distribution");
    expect(stemOf("sig-medicaid-2026-06-enrollment-trend")).toBe("medicaid-enrollment-trend");
    expect(stemOf("sig-marketplace-2026-benchmark-trend")).toBe("marketplace-benchmark-trend");
    expect(stemOf("sig-claims-cost-2024-part-b-drug-share")).toBe("claims-cost-part-b-drug-share");
  });
});

describe("shortHeadline", () => {
  it("keeps the first sentence and trims long ones", () => {
    expect(shortHeadline("Medicaid fell 5.9%. It peaked in 2023.")).toBe("Medicaid fell 5.9%");
    expect(shortHeadline("Medicaid fell 5.9%; it peaked in 2023.")).toBe("Medicaid fell 5.9%");
    // A semicolon inside a quoted rule title isn't a sentence end.
    expect(shortHeadline('CMS finalized 57 rules; most recently "Medicaid Program; Prohibition" in 2026.')).toBe("CMS finalized 57 rules");
    expect(shortHeadline('Most recently "Medicaid Program; Prohibition" in 2026.')).toBe('Most recently "Medicaid Program; Prohibition" in 2026');
    expect(shortHeadline("x".repeat(200), 20)).toHaveLength(20);
  });
});

describe("against the live sweep", () => {
  it("every related-finding stem matches a live finding", async () => {
    const live = new Set((await runFullSweep()).allInsights.map((i) => stemOf(i.id)));
    const dead = RELATED_GROUPS.flat().filter((stem) => !live.has(stem));
    expect(dead).toEqual([]);
  });

  it("gives every finding at least one stakeholder, and links related findings both ways", async () => {
    const { allInsights } = await runFullSweep();
    for (const insight of allInsights) expect(stakeholdersFor(insight), insight.id).not.toHaveLength(0);
    const medicaid = allInsights.find((i) => stemOf(i.id) === "medicaid-enrollment-trend")!;
    const related = relatedFindings(medicaid, allInsights);
    expect(related.length).toBeGreaterThan(0);
    expect(related.length).toBeLessThanOrEqual(4);
    expect(related).not.toContain(medicaid);
    for (const other of related) expect(relatedFindings(other, allInsights).map((i) => i.id)).toContain(medicaid.id);
  });
});
