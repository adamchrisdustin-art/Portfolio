/**
 * Period-over-period comparisons for dated event counts (rules published,
 * drugs approved, 8-Ks filed, trial results posted), added 2026-09-25 so
 * the executive analyst can tell which time view actually shows a shift.
 * Month-over-month is often flat for these sources, so every view the
 * history supports is computed - month, quarter, half-year, and
 * year-over-year - and each is marked notable or not by a fixed rule.
 * Code decides what's notable; the model only picks which notable shift
 * matters and explains it (same split as the rest of the reasoning layer).
 *
 * Rules come from docs/cms-intelligence/TREND_FRAMEWORK.md:
 * - Only complete calendar periods inside the data's coverage window are
 *   compared - never a partial month against a full one.
 * - Significance: for two event counts a and b, a change beyond
 *   2 * sqrt(a + b) is outside 2 standard deviations of chance variation
 *   (the framework's 2-SD anomaly rule, in its Poisson form for counts).
 * - Sample floor: a comparison where both periods are under the 11-count
 *   floor is never notable - small counts swing by chance.
 * - Seasonality: for metrics with a known annual cycle, only
 *   year-over-year views can be notable; sequential ones are still shown.
 */
import { SUPPRESSION_FLOOR } from "./trend";

export type ComparisonView = "month-over-month" | "quarter-over-quarter" | "half-over-half" | "year-over-year";

export interface PeriodCount {
  period: string;
  count: number;
}

export interface PeriodComparison {
  view: ComparisonView;
  current: PeriodCount;
  prior: PeriodCount;
  change: number;
  /** null when the prior period's count is 0. */
  percentChange: number | null;
  notable: boolean;
  basis: string;
}

export interface CountSeriesInput {
  /** One ISO date (YYYY-MM-DD) per event. */
  dates: string[];
  /** First date the data covers; periods starting earlier are incomplete. */
  coverageStart: string;
  /** Date of the pull. That day and later count as incomplete. */
  asOf: string;
  seasonal: boolean;
}

interface ViewSpec {
  view: ComparisonView;
  /** Period length in months. */
  size: number;
  /** Periods start on month indexes divisible by this (1 = rolling). */
  align: number;
  /** Months between the current period's start and the prior period's start. */
  lag: number;
}

const VIEWS: ViewSpec[] = [
  { view: "month-over-month", size: 1, align: 1, lag: 1 },
  { view: "quarter-over-quarter", size: 3, align: 3, lag: 3 },
  { view: "half-over-half", size: 6, align: 6, lag: 6 },
  { view: "year-over-year", size: 3, align: 3, lag: 12 },
  { view: "year-over-year", size: 6, align: 6, lag: 12 },
  { view: "year-over-year", size: 12, align: 1, lag: 12 },
];

/** Months since year 0, so period math is plain integer arithmetic. */
function monthIndex(isoDate: string): number {
  return Number(isoDate.slice(0, 4)) * 12 + Number(isoDate.slice(5, 7)) - 1;
}

function monthStart(index: number): string {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

function monthLabel(index: number): string {
  return monthStart(index).slice(0, 7);
}

function periodLabel(start: number, size: number): string {
  const year = Math.floor(start / 12);
  const month = start % 12;
  if (size === 1) return monthLabel(start);
  if (size === 3 && month % 3 === 0) return `${year}-Q${month / 3 + 1}`;
  if (size === 6 && month % 6 === 0) return `${year}-H${month / 6 + 1}`;
  return `${monthLabel(start)} to ${monthLabel(start + size - 1)}`;
}

function isComplete(start: number, size: number, input: CountSeriesInput): boolean {
  return monthStart(start) >= input.coverageStart && monthStart(start + size) <= input.asOf;
}

function countIn(start: number, size: number, dates: string[]): number {
  const from = monthStart(start);
  const to = monthStart(start + size);
  return dates.filter((d) => d >= from && d < to).length;
}

function judge(a: number, b: number, view: ComparisonView, seasonal: boolean): { notable: boolean; basis: string } {
  if (Math.max(a, b) < SUPPRESSION_FLOOR) {
    return { notable: false, basis: `both periods are under the ${SUPPRESSION_FLOOR}-count floor, too small to separate a shift from chance` };
  }
  const threshold = Math.round(2 * Math.sqrt(a + b) * 10) / 10;
  const change = Math.abs(a - b);
  if (seasonal && view !== "year-over-year") {
    return { notable: false, basis: "this metric has an annual cycle, so only year-over-year views can count as notable" };
  }
  return change > threshold
    ? { notable: true, basis: `the change of ${change} is beyond 2 standard deviations of chance variation (${threshold})` }
    : { notable: false, basis: `the change of ${change} is within 2 standard deviations of chance variation (${threshold})` };
}

/**
 * Every comparison the history supports, latest complete period first in
 * each view. A view is omitted, not estimated, when either period isn't
 * fully covered by the data.
 */
export function comparePeriods(input: CountSeriesInput): PeriodComparison[] {
  const lastComplete = monthIndex(input.asOf) - 1;
  const results: PeriodComparison[] = [];
  for (const spec of VIEWS) {
    let start = lastComplete - spec.size + 1;
    start -= ((start % spec.align) + spec.align) % spec.align;
    const priorStart = start - spec.lag;
    if (!isComplete(start, spec.size, input) || !isComplete(priorStart, spec.size, input)) continue;

    const current = countIn(start, spec.size, input.dates);
    const prior = countIn(priorStart, spec.size, input.dates);
    results.push({
      view: spec.view,
      current: { period: periodLabel(start, spec.size), count: current },
      prior: { period: periodLabel(priorStart, spec.size), count: prior },
      change: current - prior,
      percentChange: prior === 0 ? null : Math.round(((current - prior) / prior) * 1000) / 10,
      ...judge(current, prior, spec.view, input.seasonal),
    });
  }
  return results;
}
