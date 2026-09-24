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
