/**
 * Deterministic analysis over the full-population Medicare physician
 * summary tables (data/adapters/physicianByProviderSummary.ts): national
 * and state roll-ups, year-over-year growth split into volume and price,
 * and a check of whether the latest year's growth breaks from the
 * metric's own history. Added 2026-09-25. Code computes every number
 * here; agents only choose which results to show.
 *
 * The anomaly check is TREND_FRAMEWORK.md's rule for small or skewed
 * samples: the latest year-over-year growth is flagged when it sits more
 * than 2x the median absolute deviation (MAD) from the median of the
 * metric's own earlier year-over-year growth rates. The median and MAD
 * resist one-off shocks such as 2020's pandemic drop. It must also clear
 * a materiality floor (TREND_FRAMEWORK.md allows one): a very steady
 * history has a tiny MAD, and a 0.1-point wobble shouldn't count.
 */
import type { PhysicianYearData, Totals } from "../../data/adapters/physicianByProviderSummary";
import { isAnomaly, SUPPRESSION_FLOOR } from "../trends/trend";

/** The 50 states plus DC - territories, military and foreign codes are left out of state comparisons. */
export const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ")
);

/** A latest growth rate must also differ from the typical rate by this much (1 percentage point) to count as a break. */
export const MIN_GROWTH_DEVIATION = 0.01;

/** Minimum earlier year-over-year changes before a growth rate can be judged against its own history. */
export const MIN_HISTORY_CHANGES = 5;

export type SumTotals = Omit<Totals, "avgRiskScore">;

function emptySum(): SumTotals {
  return { providers: 0, beneficiaryProviderPairs: 0, services: 0, submittedCharges: 0, allowedAmount: 0, medicarePayment: 0, standardizedPayment: 0 };
}

function addInto(sum: SumTotals, row: Totals): void {
  sum.providers += row.providers;
  sum.beneficiaryProviderPairs += row.beneficiaryProviderPairs;
  sum.services += row.services;
  sum.submittedCharges += row.submittedCharges;
  sum.allowedAmount += row.allowedAmount;
  sum.medicarePayment += row.medicarePayment;
  sum.standardizedPayment += row.standardizedPayment;
}

/** Totals for one data year, grouped by the given key (all rows, including territories). */
function rollUp(year: PhysicianYearData, keyOf: (row: PhysicianYearData["byStateType"][number]) => string | null): Map<string, SumTotals> {
  const out = new Map<string, SumTotals>();
  for (const row of year.byStateType) {
    const key = keyOf(row);
    if (key === null) continue;
    if (!out.has(key)) out.set(key, emptySum());
    addInto(out.get(key)!, row);
  }
  return out;
}

export function nationalTotals(year: PhysicianYearData): SumTotals {
  return rollUp(year, () => "all").get("all") ?? emptySum();
}

export function nationalByProviderType(year: PhysicianYearData): Map<string, SumTotals> {
  return rollUp(year, (row) => row.providerType);
}

export function byState(year: PhysicianYearData): Map<string, SumTotals> {
  return rollUp(year, (row) => (US_STATES.has(row.state) ? row.state : null));
}

export function growth(current: number, prior: number): number | null {
  return prior > 0 ? current / prior - 1 : null;
}

/**
 * When services and payment per service swing hard in opposite directions,
 * CMS almost always counted services differently that year (drug units are
 * a common cause) - seen live in 2024: Ambulatory Surgical Center services
 * +138.6% with payment per service -52.7%. The payment change stays valid;
 * only the volume/price split doesn't.
 */
export const SPLIT_SWING_LIMIT = 0.25;

export function isSplitReliable(split: GrowthDecomposition): boolean {
  const opposite = Math.sign(split.volume) !== Math.sign(split.price);
  return !(opposite && Math.abs(split.volume) > SPLIT_SWING_LIMIT && Math.abs(split.price) > SPLIT_SWING_LIMIT);
}

export interface GrowthDecomposition {
  /** Year-over-year change in total Medicare payment. */
  payment: number;
  /** Change in services delivered. */
  volume: number;
  /** Change in Medicare payment per service; (1 + payment) = (1 + volume) * (1 + price). */
  price: number;
}

/** Splits payment growth into volume and price (payment per service). Null when either year is too small to compare. */
export function decompose(current: SumTotals, prior: SumTotals): GrowthDecomposition | null {
  if (current.providers < SUPPRESSION_FLOOR || prior.providers < SUPPRESSION_FLOOR) return null;
  if (prior.services <= 0 || current.services <= 0 || prior.medicarePayment <= 0) return null;
  const payment = current.medicarePayment / prior.medicarePayment - 1;
  const volume = current.services / prior.services - 1;
  const price = current.medicarePayment / current.services / (prior.medicarePayment / prior.services) - 1;
  return { payment, volume, price };
}

export interface HistoryCheck {
  latestGrowth: number;
  medianGrowth: number;
  mad: number;
  /** Number of earlier year-over-year changes the latest was judged against. */
  historyChanges: number;
  anomalous: boolean;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Judges the latest year-over-year growth of a yearly series (oldest
 * first) against its own earlier growth rates. Null when there's too
 * little history to judge.
 */
export function checkAgainstHistory(valuesOldestFirst: number[]): HistoryCheck | null {
  const growths: number[] = [];
  for (let i = 1; i < valuesOldestFirst.length; i++) {
    const g = growth(valuesOldestFirst[i], valuesOldestFirst[i - 1]);
    if (g === null) return null;
    growths.push(g);
  }
  if (growths.length < MIN_HISTORY_CHANGES + 1) return null;
  const latestGrowth = growths[growths.length - 1];
  const earlier = growths.slice(0, -1);
  const medianGrowth = median(earlier);
  const mad = median(earlier.map((g) => Math.abs(g - medianGrowth)));
  return {
    latestGrowth,
    medianGrowth,
    mad,
    historyChanges: earlier.length,
    anomalous: isAnomaly(latestGrowth, medianGrowth, mad, "mad") && Math.abs(latestGrowth - medianGrowth) > MIN_GROWTH_DEVIATION,
  };
}

/** Compound annual growth between two values `years` apart. */
export function cagr(current: number, prior: number, years: number): number | null {
  return prior > 0 && current > 0 && years > 0 ? (current / prior) ** (1 / years) - 1 : null;
}
