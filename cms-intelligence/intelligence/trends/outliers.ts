/**
 * Cross-sectional outliers (added 2026-09-25): which members of a group
 * (states, service codes) sit far from the rest of that group in the
 * same period. This complements the history checks (physicianTrends.ts's
 * checkAgainstHistory, periodComparison.ts), which only ask whether a
 * metric broke from its own past.
 *
 * Rule (TREND_FRAMEWORK.md, "Cross-sectional outliers"): Iglewicz and
 * Hoaglin's modified z-score, 0.6745 x (value - median) / MAD, flagged
 * when its absolute value exceeds 3.5. Median and MAD, not mean and
 * standard deviation, so one extreme member can't hide itself or others
 * by inflating the spread. The history rule's 2x MAD suits one series
 * judged against its own past; across 51 states it would flag about a
 * quarter of them, which is not "far from the rest".
 */

export const OUTLIER_Z_THRESHOLD = 3.5;
/** Below this many members, "far from the rest" isn't meaningful. */
export const MIN_GROUP_SIZE = 10;
/** Scales MAD to match a standard deviation for normally distributed data. */
const MAD_SCALE = 0.6745;

export interface GroupMember {
  id: string;
  label: string;
  value: number;
}

export interface Outlier extends GroupMember {
  modifiedZ: number;
  direction: "above" | "below";
}

export interface OutlierResult {
  groupSize: number;
  median: number;
  mad: number;
  /** Most extreme first. */
  outliers: Outlier[];
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Null when the group is too small or has no spread (MAD of 0) to judge against. */
export function findOutliers(members: GroupMember[], threshold: number = OUTLIER_Z_THRESHOLD): OutlierResult | null {
  const finite = members.filter((m) => Number.isFinite(m.value));
  if (finite.length < MIN_GROUP_SIZE) return null;
  const med = median(finite.map((m) => m.value));
  const mad = median(finite.map((m) => Math.abs(m.value - med)));
  if (mad === 0) return null;
  const outliers = finite
    .map((m) => ({ ...m, modifiedZ: (MAD_SCALE * (m.value - med)) / mad }))
    .filter((m) => Math.abs(m.modifiedZ) > threshold)
    .sort((a, b) => Math.abs(b.modifiedZ) - Math.abs(a.modifiedZ))
    .map((m) => ({ ...m, direction: m.value > med ? ("above" as const) : ("below" as const) }));
  return { groupSize: finite.length, median: med, mad, outliers };
}
