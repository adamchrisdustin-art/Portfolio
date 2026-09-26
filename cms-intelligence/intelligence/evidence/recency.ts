/**
 * Recency tiers for insights (added 2026-09-25, per Adam): recent data
 * leads, older data is kept but ranked lower, and data with no update in
 * over two years stops counting as a current signal. Recomputed on every
 * sweep, so a source that resumes publishing becomes current again on its
 * own.
 *
 * "Overdue" is measured from when a source's next update was due, not
 * from the data's own date, because some CMS files always arrive late:
 * Medicare physician data for 2024 was published in 2026 and is still the
 * newest there is. Two checks, and the worse one counts:
 * - Data age: months since the insight's period ended, minus the longest
 *   a source's newest data normally gets (publication lag + update
 *   interval).
 * - No change: months since the source's content last changed in our
 *   snapshots, minus its update interval. This catches sources pulled
 *   whole each time (hospitals, home health), whose dates always look new.
 * Tiers: overdue up to 12 months is current, 12-24 is aging, over 24 is
 * stale.
 */
import type { Insight } from "./schema";

export type RecencyTier = "current" | "aging" | "stale";

export interface SourceTiming {
  /** How often the source normally publishes new data. */
  updateIntervalMonths: number;
  /** How long after a data period ends it's normally published (0 when the period is the pull itself). */
  publicationLagMonths: number;
}

/** Every source an agent cites. recency.test.ts fails if a source in SOURCE_LABELS is missing here. */
export const SOURCE_TIMING: Record<string, SourceTiming> = {
  "cms:hospital-general-information": { updateIntervalMonths: 3, publicationLagMonths: 0 },
  "cms:home-health-care-agencies": { updateIntervalMonths: 3, publicationLagMonths: 0 },
  "cms:medicare-physician-by-provider": { updateIntervalMonths: 12, publicationLagMonths: 17 },
  "cms:medicare-physician-by-service": { updateIntervalMonths: 12, publicationLagMonths: 17 },
  "cms:ma-part-d-enrollment": { updateIntervalMonths: 1, publicationLagMonths: 1 },
  "cms:marketplace-rate-puf": { updateIntervalMonths: 12, publicationLagMonths: 0 },
  "cms:marketplace-oep-state": { updateIntervalMonths: 12, publicationLagMonths: 0 },
  "cms:medicaid-state-enrollment": { updateIntervalMonths: 1, publicationLagMonths: 3 },
  "cms:medicaid-managed-care-plans": { updateIntervalMonths: 12, publicationLagMonths: 14 },
  "federal-register:cms-documents": { updateIntervalMonths: 1, publicationLagMonths: 0 },
  "sec-edgar:healthcare-8k-filings": { updateIntervalMonths: 1, publicationLagMonths: 0 },
  "openfda:drugsfda-novel-approvals": { updateIntervalMonths: 1, publicationLagMonths: 0 },
  "nih-reporter:project-awards": { updateIntervalMonths: 1, publicationLagMonths: 0 },
  "clinicaltrials-gov:phase3-results": { updateIntervalMonths: 1, publicationLagMonths: 0 },
  // A new rate year every January (quarterly corrections in between); the period is the rate year itself.
  "cms:physician-fee-schedule": { updateIntervalMonths: 12, publicationLagMonths: 0 },
  // One payment year per federal fiscal year; the period is the payment year itself.
  "cms:hospital-penalty-programs": { updateIntervalMonths: 12, publicationLagMonths: 0 },
  "cms:provider-of-services": { updateIntervalMonths: 3, publicationLagMonths: 2 },
  "cms:facility-change-of-ownership": { updateIntervalMonths: 3, publicationLagMonths: 1 },
  "cms:facility-all-owners": { updateIntervalMonths: 1, publicationLagMonths: 0 },
  "sec-edgar:health-industry-8k": { updateIntervalMonths: 1, publicationLagMonths: 0 },
  "sec-edgar:form-d-health": { updateIntervalMonths: 3, publicationLagMonths: 1 },
};

export const AGING_AFTER_MONTHS = 12;
export const STALE_AFTER_MONTHS = 24;
const DAYS_PER_MONTH = 30.44;

export const monthsBetween = (from: string, to: Date) => (to.getTime() - new Date(from).getTime()) / (DAYS_PER_MONTH * 864e5);

export function tierFor(overdueMonths: number): RecencyTier {
  if (overdueMonths > STALE_AFTER_MONTHS) return "stale";
  if (overdueMonths > AGING_AFTER_MONTHS) return "aging";
  return "current";
}

/** Months a source is past its next expected update; 0 or less means on schedule. */
export function overdueMonths(input: { periodEnd: string; unchangedSince: string | null; timing: SourceTiming; now: Date }): number {
  const { periodEnd, unchangedSince, timing, now } = input;
  const byAge = monthsBetween(periodEnd, now) - (timing.publicationLagMonths + timing.updateIntervalMonths);
  const byNoChange = unchangedSince ? monthsBetween(unchangedSince, now) - timing.updateIntervalMonths : -Infinity;
  return Math.max(byAge, byNoChange);
}

/**
 * Sets each insight's freshness.recency and freshness.isStale. An insight
 * built from several sources takes its most overdue one. A source with no
 * timing entry is treated as current rather than guessed at.
 */
export function applyRecency(insights: Insight[], now: Date, unchangedSince: Record<string, string>): Insight[] {
  return insights.map((insight) => {
    const overdue = Math.max(
      ...insight.sourceIds.map((sourceId) => {
        const timing = SOURCE_TIMING[sourceId];
        return timing ? overdueMonths({ periodEnd: insight.period.end, unchangedSince: unchangedSince[sourceId] ?? null, timing, now }) : -Infinity;
      })
    );
    const recency = tierFor(overdue);
    return { ...insight, freshness: { ...insight.freshness, recency, isStale: recency === "stale" } };
  });
}

/** Sort weight: current first, then aging, then stale. */
export const RECENCY_ORDER: Record<RecencyTier, number> = { current: 0, aging: 1, stale: 2 };
