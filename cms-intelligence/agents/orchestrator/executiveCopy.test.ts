import { describe, expect, it } from "vitest";
import { runFullSweep } from "./fullSweep";

/**
 * Everything on a finding card is read by executives, so internal references
 * (question IDs, repo doc names, code comments) must stay out of it. Added
 * after the Phase 7 reviewer test (2026-09-25) found them on the live page.
 */
const INTERNAL = [
  { name: "question ID", pattern: /\bQ\d{3}\b/ },
  { name: "repo doc file", pattern: /\b[A-Z0-9_]+\.md\b/ },
  { name: "code reference", pattern: /file header|diffRows|meant to demonstrate/i },
  { name: "first-pull claim", pattern: /first real (snapshot|pull)|no prior pull exists/i },
];

describe("executive-facing finding text", () => {
  it("has no internal references", async () => {
    const { allInsights } = await runFullSweep();
    const leaks: string[] = [];
    for (const insight of allInsights) {
      const fields = [
        insight.headline,
        insight.businessRelevance,
        insight.confidenceRationale,
        insight.nextSignal,
        ...insight.limitations,
        ...insight.evidence.map((e) => e.description),
      ];
      for (const text of fields) {
        for (const { name, pattern } of INTERNAL) {
          if (pattern.test(text)) leaks.push(`${insight.id}: ${name} in "${text.slice(0, 80)}"`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });
});
