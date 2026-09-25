/**
 * Code-computed cross-sectional outliers handed to the executive analyst
 * alongside the agents' insights and the period comparisons (added
 * 2026-09-25). Period comparisons ask "did this break from its own
 * past?"; these ask "which state or service is far from the rest this
 * year?" (intelligence/trends/outliers.ts has the rule).
 *
 * Values are stored as display strings ("69.1%", "$1,093.95") so the
 * analyst can copy them exactly and grounding can trace them.
 */
import type { PhysicianYearData } from "../data/adapters/physicianByProviderSummary";
import { loadAllYears } from "../data/adapters/physicianByProviderSummary";
import type { ServiceYearData } from "../data/adapters/physicianServiceSummary";
import { loadAllServiceYears } from "../data/adapters/physicianServiceSummary";
import type { OepYear } from "../data/adapters/marketplaceEnrollment";
import { loadAllOepYears, stateRows, valueOf } from "../data/adapters/marketplaceEnrollment";
import type { MarketplaceYearSummary } from "../data/adapters/marketplaceRatePuf";
import { loadAllPlanYears } from "../data/adapters/marketplaceRatePuf";
import type { HomeHealthSnapshot } from "../data/adapters/homeHealthCareAgencies";
import { loadLatestSnapshot, parseNumericCell } from "../data/adapters/homeHealthCareAgencies";
import { byState, US_STATES } from "../intelligence/metrics/physicianTrends";
import { findOutliers, type GroupMember } from "../intelligence/trends/outliers";
import { SUPPRESSION_FLOOR } from "../intelligence/trends/trend";
import { SOURCE_ID_BY_DATASET } from "./sourceFingerprints";

export interface OutlierFact {
  id: string;
  label: string;
  value: string;
  direction: "above" | "below";
  modifiedZ: number;
  /** Extra context a reader needs, such as a service code's dollar change. */
  detail?: string;
}

export interface MetricOutlierFacts {
  metric: string;
  sourceId: string;
  period: string;
  group: string;
  groupSize: number;
  median: string;
  /** How many members the rule flagged; outliers may list fewer (the largest, when capped). */
  flaggedCount: number;
  outliers: OutlierFact[];
}

export interface OutlierInputs {
  physicianYears: PhysicianYearData[];
  serviceYears: ServiceYearData[];
  oepYears: OepYear[];
  planYears: MarketplaceYearSummary[];
  homeHealth: HomeHealthSnapshot | null;
}

/** Service codes must pay at least this much (standardized) in both years to be compared - small codes swing by large percentages on little money. */
export const SERVICE_MIN_PAYMENT = 50_000_000;
/** A flagged service code must also have moved at least this many dollars to be listed. */
export const SERVICE_MIN_DOLLAR_CHANGE = 25_000_000;
/** At most this many service outliers are listed: the ones with the largest dollar changes. */
export const MAX_SERVICE_OUTLIERS = 10;

type Format = (value: number) => string;
const pct: Format = (v) => `${(v * 100).toFixed(1)}%`;
const usd: Format = (v) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fixed2: Format = (v) => v.toFixed(2);
const usdMillions = (v: number) => `${v < 0 ? "-" : "+"}$${(Math.abs(v) / 1e6).toFixed(1)}M`;

function toFacts(
  spec: { metric: string; dataset: string; period: string; group: string; format: Format },
  members: GroupMember[],
  detail?: (id: string) => string | undefined,
  pick: (flagged: GroupMember[]) => GroupMember[] = (f) => f
): MetricOutlierFacts | null {
  const result = findOutliers(members);
  if (!result) return null;
  const listed = new Set(pick(result.outliers).map((o) => o.id));
  return {
    metric: spec.metric,
    sourceId: SOURCE_ID_BY_DATASET[spec.dataset] ?? spec.dataset,
    period: spec.period,
    group: spec.group,
    groupSize: result.groupSize,
    median: spec.format(result.median),
    flaggedCount: result.outliers.length,
    outliers: result.outliers
      .filter((o) => listed.has(o.id))
      .map((o) => ({
        id: o.id,
        label: o.label,
        value: spec.format(o.value),
        direction: o.direction,
        modifiedZ: Math.round(o.modifiedZ * 10) / 10,
        ...(detail?.(o.id) ? { detail: detail(o.id) } : {}),
      })),
  };
}

const stateMember = (state: string, value: number): GroupMember => ({ id: state, label: state, value });

function physicianFacts(years: PhysicianYearData[]): (MetricOutlierFacts | null)[] {
  const sorted = [...years].sort((a, b) => a.dataYear - b.dataYear);
  const current = sorted.at(-1);
  const prior = sorted.at(-2);
  if (!current) return [];
  const dataset = "medicare-physician-by-provider-summary";
  const group = "50 states and DC";
  const now = [...byState(current)].filter(([s, t]) => US_STATES.has(s) && t.providers >= SUPPRESSION_FLOOR);
  const facts = [
    toFacts(
      { metric: "Medicare standardized payment per beneficiary-provider pair (Part B practitioners)", dataset, period: String(current.dataYear), group, format: usd },
      now.map(([s, t]) => stateMember(s, t.standardizedPayment / t.beneficiaryProviderPairs))
    ),
    toFacts(
      { metric: "Part B services per beneficiary-provider pair", dataset, period: String(current.dataYear), group, format: fixed2 },
      now.map(([s, t]) => stateMember(s, t.services / t.beneficiaryProviderPairs))
    ),
  ];
  if (prior) {
    const before = byState(prior);
    const period = `${prior.dataYear} to ${current.dataYear}`;
    const both = now.filter(([s]) => (before.get(s)?.providers ?? 0) >= SUPPRESSION_FLOOR);
    facts.push(
      toFacts(
        { metric: "Year-over-year change in Medicare standardized payment to Part B practitioners", dataset, period, group, format: pct },
        both.map(([s, t]) => stateMember(s, t.standardizedPayment / before.get(s)!.standardizedPayment - 1))
      ),
      toFacts(
        { metric: "Year-over-year change in Part B practitioners billing Medicare", dataset, period, group, format: pct },
        both.map(([s, t]) => stateMember(s, t.providers / before.get(s)!.providers - 1))
      )
    );
  }
  return facts;
}

function serviceFacts(years: ServiceYearData[]): MetricOutlierFacts | null {
  const sorted = [...years].sort((a, b) => a.dataYear - b.dataYear);
  const current = sorted.at(-1);
  const prior = sorted.at(-2);
  if (!current || !prior) return null;
  const before = new Map(prior.services.map((r) => [r.code, r]));
  const compared = current.services.filter((r) => r.standardizedPayment >= SERVICE_MIN_PAYMENT && (before.get(r.code)?.standardizedPayment ?? 0) >= SERVICE_MIN_PAYMENT);
  const dollarChange = new Map(compared.map((r) => [r.code, r.standardizedPayment - before.get(r.code)!.standardizedPayment]));
  return toFacts(
    {
      metric: "Year-over-year change in Medicare standardized payment by service code (codes paid at least $50M in both years)",
      dataset: "medicare-physician-by-service-summary",
      period: `${prior.dataYear} to ${current.dataYear}`,
      group: "service codes",
      format: pct,
    },
    compared.map((r) => ({ id: r.code, label: `${r.code} ${r.description}${r.isDrug ? " (Part B drug)" : ""}`, value: r.standardizedPayment / before.get(r.code)!.standardizedPayment - 1 })),
    (code) => `standardized payment change ${usdMillions(dollarChange.get(code)!)}`,
    (flagged) =>
      flagged
        .filter((o) => Math.abs(dollarChange.get(o.id)!) >= SERVICE_MIN_DOLLAR_CHANGE)
        .sort((a, b) => Math.abs(dollarChange.get(b.id)!) - Math.abs(dollarChange.get(a.id)!))
        .slice(0, MAX_SERVICE_OUTLIERS)
  );
}

function enrollmentFacts(years: OepYear[]): (MetricOutlierFacts | null)[] {
  const sorted = [...years].sort((a, b) => a.planYear - b.planYear);
  const current = sorted.at(-1);
  const prior = sorted.at(-2);
  if (!current || !prior) return [];
  const before = new Map(stateRows(prior).map((r) => [r.state, r]));
  const change = (column: string) =>
    stateRows(current).flatMap((r) => {
      const p = before.get(r.state);
      const now = valueOf(current, r, column);
      const then = p ? valueOf(prior, p, column) : null;
      return US_STATES.has(r.state) && now !== null && then !== null && then >= SUPPRESSION_FLOOR ? [stateMember(r.state, now / then - 1)] : [];
    });
  const spec = (metric: string) => ({ metric, dataset: "marketplace-oep-state", period: `plan year ${prior.planYear} to ${current.planYear}`, group: "50 states and DC", format: pct });
  return [
    toFacts(spec("Year-over-year change in Marketplace open-enrollment plan selections (consumers)"), change("Cnsmr")),
    toFacts(spec("Year-over-year change in new Marketplace consumers"), change("New_Cnsmr")),
  ];
}

function premiumFacts(years: MarketplaceYearSummary[]): (MetricOutlierFacts | null)[] {
  const sorted = [...years].sort((a, b) => a.planYear - b.planYear);
  const current = sorted.at(-1);
  const prior = sorted.at(-2);
  if (!current) return [];
  const dataset = "marketplace-rate-puf";
  const group = "HealthCare.gov states";
  const metricBase = `benchmark (second-lowest silver) premium at age ${current.referenceAge}, median across the state's rating areas`;
  const facts = [
    toFacts(
      { metric: `Monthly ${metricBase}`, dataset, period: `plan year ${current.planYear}`, group, format: usd },
      current.states.flatMap((s) => (s.benchmarkMedian !== null ? [stateMember(s.state, s.benchmarkMedian)] : []))
    ),
  ];
  if (prior) {
    const before = new Map(prior.states.map((s) => [s.state, s.benchmarkMedian]));
    facts.push(
      toFacts(
        { metric: `Year-over-year change in the ${metricBase}`, dataset, period: `plan year ${prior.planYear} to ${current.planYear}`, group, format: pct },
        current.states.flatMap((s) => {
          const then = before.get(s.state);
          return s.benchmarkMedian !== null && then ? [stateMember(s.state, s.benchmarkMedian / then - 1)] : [];
        })
      )
    );
  }
  return facts;
}

function homeHealthFacts(snapshot: HomeHealthSnapshot | null): MetricOutlierFacts | null {
  if (!snapshot) return null;
  const byStateSums = new Map<string, { weighted: number; episodes: number }>();
  for (const row of snapshot.rows) {
    const ratio = parseNumericCell(row.how_much_medicare_spends_on_an_episode_of_care_at_this_agen_56e6);
    const episodes = parseNumericCell(row.no_of_episodes_to_calc_how_much_medicare_spends_per_episode_4f4e);
    if (!US_STATES.has(row.state ?? "") || !Number.isFinite(ratio) || !Number.isFinite(episodes) || episodes <= 0) continue;
    const sums = byStateSums.get(row.state!) ?? { weighted: 0, episodes: 0 };
    sums.weighted += ratio * episodes;
    sums.episodes += episodes;
    byStateSums.set(row.state!, sums);
  }
  return toFacts(
    {
      metric: "Home health Medicare spending per episode relative to the national average (episode-weighted, 1.00 = national)",
      dataset: "home-health-care-agencies",
      period: `snapshot pulled ${snapshot.pulledAt.slice(0, 10)}`,
      group: "50 states and DC",
      format: fixed2,
    },
    [...byStateSums].map(([s, sums]) => stateMember(s, sums.weighted / sums.episodes))
  );
}

export function outlierFactsFrom(inputs: OutlierInputs): MetricOutlierFacts[] {
  return [
    ...physicianFacts(inputs.physicianYears),
    serviceFacts(inputs.serviceYears),
    ...enrollmentFacts(inputs.oepYears),
    ...premiumFacts(inputs.planYears),
    homeHealthFacts(inputs.homeHealth),
  ].filter((f): f is MetricOutlierFacts => f !== null);
}

export function buildOutlierFacts(): MetricOutlierFacts[] {
  return outlierFactsFrom({
    physicianYears: loadAllYears(),
    serviceYears: loadAllServiceYears(),
    oepYears: loadAllOepYears(),
    planYears: loadAllPlanYears(),
    homeHealth: loadLatestSnapshot(),
  });
}
