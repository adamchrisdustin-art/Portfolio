/**
 * Pure-function implementations of a subset of docs/cms-intelligence/
 * METRIC_DICTIONARY.md's formulas. Deterministic code, never an LLM call -
 * see AGENT_ARCHITECTURE.md's "deterministic-first" cross-cutting rule.
 * Only the formulas Phase 3's agents actually use are implemented here;
 * add more as later phases need them rather than implementing the whole
 * dictionary speculatively (Phase 1's "don't overbuild" guidance).
 */

/** (current - prior) / prior, as a percent. */
export function growthRate(current: number, prior: number): number {
  if (prior === 0) {
    throw new Error("growthRate: prior value is 0 - growth rate is undefined, do not divide by zero");
  }
  return ((current - prior) / prior) * 100;
}

/** Change in growth rate itself between two consecutive periods - a second derivative. */
export function acceleration(currentGrowthRate: number, priorGrowthRate: number): number {
  return currentGrowthRate - priorGrowthRate;
}

/** service count per 1,000 covered population, same geography/population. */
export function utilizationPer1000(serviceCount: number, coveredPopulation: number): number {
  if (coveredPopulation === 0) {
    throw new Error("utilizationPer1000: coveredPopulation is 0");
  }
  return (serviceCount / coveredPopulation) * 1000;
}

/** enrolled / eligible, as a percent - both must be the same program's population. */
export function penetration(enrolled: number, eligible: number): number {
  if (eligible === 0) {
    throw new Error("penetration: eligible population is 0");
  }
  return (enrolled / eligible) * 100;
}

/**
 * Concentration ratio (CR-N): combined share of the top N entities out of
 * total volume. Default method per METRIC_DICTIONARY.md - see that doc
 * for why CR-N was chosen over HHI as this system's default.
 */
export function concentrationRatio(sortedDescendingValues: number[], topN: number, total: number): number {
  if (total === 0) {
    throw new Error("concentrationRatio: total is 0");
  }
  const top = sortedDescendingValues.slice(0, topN).reduce((sum, v) => sum + v, 0);
  return (top / total) * 100;
}

/** total allowed-or-paid cost / member-months (not member count - see METRIC_DICTIONARY.md). */
export function pmpm(totalCost: number, memberMonths: number): number {
  if (memberMonths === 0) {
    throw new Error("pmpm: memberMonths is 0");
  }
  return totalCost / memberMonths;
}

/** a category's volume (or cost) / total across all categories, same classification scheme. */
export function mixShare(categoryValue: number, totalValue: number): number {
  if (totalValue === 0) {
    throw new Error("mixShare: totalValue is 0");
  }
  return (categoryValue / totalValue) * 100;
}

export interface Quartiles {
  q1: number;
  median: number;
  q3: number;
}

/** Linear-interpolation quartiles - standard method, no external stats library needed. Input must already be sorted ascending. */
export function quartiles(sortedAscendingValues: number[]): Quartiles {
  const at = (p: number) => {
    const idx = p * (sortedAscendingValues.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sortedAscendingValues[lo];
    return sortedAscendingValues[lo] + (sortedAscendingValues[hi] - sortedAscendingValues[lo]) * (idx - lo);
  };
  return { q1: at(0.25), median: at(0.5), q3: at(0.75) };
}

/**
 * Pearson correlation coefficient between two equal-length real series -
 * added 2026-09-24 for the star-rating-vs-quality-outcome scatter read
 * (provider-network/agent.ts). Returns 0 (not NaN) when either series has
 * zero variance, since "no linear relationship is measurable" is the
 * honest read in that case, not a computation error. A correlation value
 * alone is never sufficient grounds for a "confirmed-causal" driver
 * relationship - see EVIDENCE_MODEL.md and this metric's callers, which
 * must use "correlation".
 */
export function pearsonCorrelation(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length === 0) {
    throw new Error("pearsonCorrelation: xs and ys must be the same non-zero length");
  }
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (denomX === 0 || denomY === 0) return 0;
  return numerator / Math.sqrt(denomX * denomY);
}

/** Smallest |r| that is significant at p < 0.05 (two-tailed) for n points: t = 1.96 approximation, r = t / sqrt(n - 2 + t^2). */
export function criticalR(n: number): number {
  return 1.96 / Math.sqrt(n - 2 + 1.96 ** 2);
}

export interface TukeyBox extends Quartiles {
  whiskerLow: number;
  whiskerHigh: number;
  outliers: number[];
  sampleSize: number;
}

/**
 * Standard Tukey convention: whiskers extend to the most extreme value
 * within 1.5x IQR of the box, not the raw sample min/max - a single
 * outlier would otherwise stretch the axis and flatten every other
 * group's box into an unreadable sliver. Real values beyond the whisker
 * are kept, not discarded - returned as individual outlier points.
 * Extracted from claims-utilization-cost/agent.ts's original
 * boxplotByState once a second real agent (commercial-marketplace)
 * needed the same computation.
 */
export function tukeyBox(values: number[]): TukeyBox {
  const sorted = [...values].sort((a, b) => a - b);
  const { q1, median, q3 } = quartiles(sorted);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const inRange = sorted.filter((v) => v >= lowerFence && v <= upperFence);
  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);
  return {
    // With few values an interpolated quartile can sit beyond the last in-range value; a whisker never ends inside the box.
    whiskerLow: inRange.length > 0 ? Math.min(inRange[0], q1) : q1,
    q1,
    median,
    q3,
    whiskerHigh: inRange.length > 0 ? Math.max(inRange[inRange.length - 1], q3) : q3,
    outliers,
    sampleSize: sorted.length,
  };
}
