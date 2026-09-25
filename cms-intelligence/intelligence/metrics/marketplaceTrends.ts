/**
 * Like-for-like trend math over the Marketplace plan-year summaries
 * (data/adapters/marketplaceRatePuf.ts). The federal files only cover
 * HealthCare.gov states and that set changes as states move to their own
 * exchanges, so a simple year-by-year median would mix a change in
 * premiums with a change in which states are counted. Series here use a
 * fixed panel of states present in every year; year-over-year changes
 * use every state present in both years.
 */
import type { MarketplaceYearSummary, StateSummary } from "../../data/adapters/marketplaceRatePuf";
import { median } from "../../data/adapters/marketplaceRatePuf";

export type StateMetric = "benchmarkMedian" | "lowestBronzeMedian" | "silverDeductibleMedian" | "bronzeDeductibleMedian";

/** States present in every plan year given. */
export function panelStates(years: MarketplaceYearSummary[]): string[] {
  if (years.length === 0) return [];
  const [first, ...rest] = years;
  return first.states.map((s) => s.state).filter((state) => rest.every((y) => y.states.some((s) => s.state === state)));
}

/** Median of a state metric across the panel, one point per year. */
export function panelSeries(years: MarketplaceYearSummary[], metric: StateMetric, panel: string[] = panelStates(years)): { year: number; value: number }[] {
  const inPanel = new Set(panel);
  return years.flatMap((y) => {
    const value = median(y.states.filter((s) => inPanel.has(s.state) && s[metric] !== null).map((s) => s[metric]!));
    return value === null ? [] : [{ year: y.planYear, value }];
  });
}

export interface StateChange {
  state: string;
  current: number;
  prior: number;
  change: number;
  /** Relative change; null when the prior value is 0. */
  growth: number | null;
}

/** Per-state change in a metric between two plan years, states present in both. */
export function stateChanges(current: MarketplaceYearSummary, prior: MarketplaceYearSummary, metric: StateMetric): StateChange[] {
  const priorByState = new Map(prior.states.map((s) => [s.state, s]));
  return current.states.flatMap((s) => {
    const p = priorByState.get(s.state);
    const cur = s[metric];
    const prev = p?.[metric];
    if (cur === null || prev === null || prev === undefined) return [];
    return [{ state: s.state, current: cur, prior: prev, change: cur - prev, growth: prev === 0 ? null : cur / prev - 1 }];
  });
}

export interface IssuerFlow {
  state: string;
  issuers: number;
  priorIssuers: number;
  entered: number;
  exited: number;
}

/** Issuers entering and leaving each state present in both years (by opaque HIOS id). */
export function issuerFlows(current: MarketplaceYearSummary, prior: MarketplaceYearSummary): IssuerFlow[] {
  const priorByState = new Map<string, StateSummary>(prior.states.map((s) => [s.state, s]));
  return current.states.flatMap((s) => {
    const p = priorByState.get(s.state);
    if (!p) return [];
    const before = new Set(p.issuerIds);
    const now = new Set(s.issuerIds);
    return [
      {
        state: s.state,
        issuers: now.size,
        priorIssuers: before.size,
        entered: s.issuerIds.filter((id) => !before.has(id)).length,
        exited: p.issuerIds.filter((id) => !now.has(id)).length,
      },
    ];
  });
}

/** States in the prior year's file but not the current one (moved to their own exchange), and the reverse. */
export function coverageChanges(current: MarketplaceYearSummary, prior: MarketplaceYearSummary): { left: string[]; joined: string[] } {
  const now = new Set(current.states.map((s) => s.state));
  const before = new Set(prior.states.map((s) => s.state));
  return { left: [...before].filter((s) => !now.has(s)).sort(), joined: [...now].filter((s) => !before.has(s)).sort() };
}
