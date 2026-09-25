/**
 * Claims-agent insights from the full-population Medicare physician
 * summary tables (added 2026-09-25): every Part B provider, every data
 * year CMS publishes. These answer the cost-growth questions directly:
 * how fast payment grew (Q012), and whether that growth came from volume
 * or from payment per service (Q013/Q014). The math lives in
 * intelligence/metrics/physicianTrends.ts; this file only turns results
 * into insights, with the salience layer choosing which rows to show.
 */
import { SOURCE_ID, type PhysicianYearData } from "../../data/adapters/physicianByProviderSummary";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import {
  byState,
  cagr,
  checkAgainstHistory,
  decompose,
  isSplitReliable,
  growth,
  nationalByProviderType,
  nationalTotals,
  SPLIT_SWING_LIMIT,
  type HistoryCheck,
} from "../../intelligence/metrics/physicianTrends";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence, directionOf, meetsPersistence } from "../../intelligence/trends/trend";
import type { AgentContext } from "../types";

const AGENT_ID = "claims-utilization-cost-intelligence";
const TOP_N_TYPES = 6;
const TOP_N_STATES = 6;
/** Provider types smaller than this in the latest year are left out - their growth rates swing on a handful of providers. */
const MIN_TYPE_PAYMENT = 100_000_000;

const pct = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
const billions = (x: number) => (Math.abs(x) >= 1e9 ? `$${(x / 1e9).toFixed(1)}B` : `$${(x / 1e6).toFixed(0)}M`);
const millions = (x: number) => `$${(x / 1e6).toFixed(0)}M`;
const yearEnd = (year: number) => `${year}-12-31`;

function historyNote(check: HistoryCheck | null, firstYear: number, priorYear: number): string {
  if (!check) return "can't yet be judged against its own history (too few years)";
  return check.anomalous
    ? `breaks from its own ${firstYear}-${priorYear} pattern (median yearly change ${pct(check.medianGrowth)})`
    : `in line with its own ${firstYear}-${priorYear} pattern (median yearly change ${pct(check.medianGrowth)})`;
}

const evidenceFor = (years: PhysicianYearData[], id: string) => ({
  id,
  sourceId: SOURCE_ID,
  description: `CMS Medicare Physician & Other Practitioners - by Provider, every provider in each data year ${years[0].dataYear}-${years[years.length - 1].dataYear} (${years[years.length - 1].providerCount.toLocaleString()} providers in ${years[years.length - 1].dataYear}), summarized at pull time`,
  datasetVintage: yearEnd(years[years.length - 1].dataYear),
});

const COMMON_LIMITATIONS = [
  "Covers Medicare fee-for-service Part B professional services only - not Medicare Advantage, hospital facility payments, or commercial insurance.",
  "CMS publishes each data year with a lag of more than a year, so the latest year here is not the current year.",
  "Payment per service mixes fee-schedule changes with a shift toward costlier services, so the price component is payment per service, not a pure fee change.",
];

function nationalTrendInsight(years: PhysicianYearData[]): Insight | null {
  const totals = years.map((y) => ({ year: y.dataYear, ...nationalTotals(y) }));
  const latest = totals[totals.length - 1];
  const prior = totals[totals.length - 2];
  const split = decompose(latest, prior);
  if (!split) return null;

  const check = checkAgainstHistory(totals.map((t) => t.medicarePayment));
  const directions = totals.slice(1).map((t, i) => directionOf(t.medicarePayment, totals[i].medicarePayment));
  const persistent = meetsPersistence(directions);
  const confidence = classifyConfidence({ persistenceMet: persistent, hasFullBaseline: true, hasExternalCorroboration: false });
  const decade = totals.length > 10 ? totals[totals.length - 11] : null;
  const decadeRate = decade ? cagr(latest.medicarePayment, decade.medicarePayment, latest.year - decade.year) : null;

  return validateInsight({
    id: `sig-claims-cost-${latest.year}-physician-payment-trend`,
    headline: `Medicare paid ${billions(latest.medicarePayment)} for Part B physician and practitioner services in ${latest.year}, ${pct(split.payment)} from ${prior.year}: services ${pct(split.volume)}, payment per service ${pct(split.price)}.`,
    questionId: "Q012",
    signalType: check?.anomalous ? "anomaly" : persistent ? "trend" : "baseline",
    period: { start: `${totals[0].year}-01-01`, end: yearEnd(latest.year) },
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States (all providers)" },
    magnitude: { value: split.payment * 100, unit: "percent", comparedTo: `${prior.year} total Medicare Part B professional payment`, delta: latest.medicarePayment - prior.medicarePayment },
    drivers: [
      {
        description: `Every Part B provider each year, summed. ${latest.year}: ${billions(latest.medicarePayment)} paid for ${Math.round(latest.services).toLocaleString()} services by ${latest.providers.toLocaleString()} providers. The ${pct(split.payment)} change splits into ${pct(split.volume)} in services and ${pct(split.price)} in payment per service; the change ${historyNote(check, totals[0].year, prior.year)}.${decadeRate !== null && decade ? ` Compound growth since ${decade.year}: ${pct(decadeRate)} a year.` : ""}`,
        supportingEvidenceIds: ["ev-phys-national"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "The national growth rate of Medicare professional spending, and how much of it is more care versus costlier care - the benchmark any payer or provider group compares its own cost trend against.",
    evidence: [evidenceFor(years, "ev-phys-national")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Based on ${totals.length} years of full-population CMS data, not a sample.`,
    freshness: { dataAsOf: yearEnd(latest.year), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [...COMMON_LIMITATIONS, "2020's pandemic drop is part of the history; the median-based check resists it, but year-over-year rates around 2020-2021 are distorted."],
    nextSignal: `Watch whether CMS's ${latest.year + 1} data continues the ${pct(split.price)} change in payment per service, which tracks fee-schedule updates and service mix.`,
    recommendedInternalValidation: "Compare against a plan's or group's own professional cost trend for the same year, split the same way into volume and unit cost.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: {
      label: "Total Medicare Part B professional payment",
      unit: "USD",
      points: totals.map((t) => ({ date: yearEnd(t.year), value: Math.round(t.medicarePayment) })),
    },
  });
}

async function providerTypeGrowthInsight(years: PhysicianYearData[], ctx: AgentContext): Promise<Insight | null> {
  const latestYear = years[years.length - 1];
  const priorYear = years[years.length - 2];
  const byTypeByYear = years.map(nationalByProviderType);
  const latest = byTypeByYear[byTypeByYear.length - 1];
  const prior = byTypeByYear[byTypeByYear.length - 2];

  const rows = [...latest.entries()]
    .filter(([, t]) => t.medicarePayment >= MIN_TYPE_PAYMENT)
    .map(([type, cur]) => {
      const prev = prior.get(type);
      const split = prev ? decompose(cur, prev) : null;
      const series = byTypeByYear.map((m) => m.get(type)?.medicarePayment ?? 0);
      const firstPresent = series.findIndex((v) => v > 0);
      const check = firstPresent >= 0 ? checkAgainstHistory(series.slice(firstPresent)) : null;
      return split && prev ? { type, cur, prev, split, check, since: years[firstPresent].dataYear } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return null;

  const describe = (r: (typeof rows)[number]) =>
    `payment ${pct(r.split.payment)} (${millions(r.prev.medicarePayment)} to ${millions(r.cur.medicarePayment)}), ${
      isSplitReliable(r.split)
        ? `services ${pct(r.split.volume)}, payment per service ${pct(r.split.price)}`
        : `services and payment per service swung in opposite directions (${pct(r.split.volume)} / ${pct(r.split.price)}), which usually means CMS counted services differently that year, so the volume/price split isn't reliable`
    }; ${historyNote(r.check, r.since, priorYear.dataYear)}`;
  const candidates: Candidate[] = rows.map((r) => ({
    id: r.type,
    label: r.type,
    summary: describe(r),
    primaryMetric: Math.abs(r.cur.medicarePayment - r.prev.medicarePayment),
  }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_TYPES, taskDescription: `Medicare Part B payment growth by provider type, ${priorYear.dataYear} to ${latestYear.dataYear}, split into volume and payment per service` },
    ctx
  );
  const byType = new Map(rows.map((r) => [r.type, r]));
  const selected = selections.map((s) => ({ row: byType.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;

  const judged = rows.filter((r) => r.check !== null);
  const anomalies = judged.filter((r) => r.check?.anomalous);
  // Led by dollars, not percent: the top percent movers are often providers relabeling their specialty (seen live: 2016's
  // Interventional Cardiology +35.7% with services +35.7% as providers moved out of Cardiology).
  const biggest = [...rows].sort((a, b) => Math.abs(b.cur.medicarePayment - b.prev.medicarePayment) - Math.abs(a.cur.medicarePayment - a.prev.medicarePayment))[0];
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-claims-cost-${latestYear.dataYear}-physician-type-growth`,
    headline: `${judged.length > 0 ? `${anomalies.length} of ${judged.length} major provider types had ${latestYear.dataYear} Medicare payment growth that broke from their own history; ` : ""}${biggest.type} had the largest dollar change, ${pct(biggest.split.payment)} (${millions(biggest.prev.medicarePayment)} to ${millions(biggest.cur.medicarePayment)}${isSplitReliable(biggest.split) ? `; services ${pct(biggest.split.volume)}, payment per service ${pct(biggest.split.price)}` : ""}).`,
    questionId: "Q013",
    signalType: anomalies.length > 0 ? "anomaly" : "baseline",
    period: { start: `${priorYear.dataYear}-01-01`, end: yearEnd(latestYear.dataYear) },
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States (all providers)" },
    magnitude: { value: biggest.split.payment * 100, unit: "percent", comparedTo: `${biggest.type} ${priorYear.dataYear} Medicare payment` },
    drivers: [
      {
        description: `Provider types with at least ${millions(MIN_TYPE_PAYMENT)} in ${latestYear.dataYear} Medicare payment, each growth rate split into volume and payment per service and judged against that type's own yearly changes (2x median absolute deviation): ${selected.map(({ row, rationale }) => `${row.type}: ${describe(row)}${source === "llm" ? ` - ${rationale}` : ""}`).join("; ")}.${source === "llm" ? ` Candidate selection method: model-reasoned salience ranking over all ${rows.length} provider types.` : ` Candidate selection method: deterministic ranking by dollar change.`}`,
        supportingEvidenceIds: ["ev-phys-types"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Separates specialties where Medicare is buying more care from those where each service costs more - different signals for network, contracting and utilization-management planning.",
    evidence: [evidenceFor(years, "ev-phys-types")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Full-population data with ${years.length} years of history per provider type, but a single year's break is an anomaly, not yet a trend.`,
    freshness: { dataAsOf: yearEnd(latestYear.dataYear), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "Provider types are CMS's self-reported specialty labels; a provider that changes its label moves its payments between types.",
      "With dozens of provider types checked at 2 MADs, one or two can break from their history by chance.",
      `Where services and payment per service swing more than ${SPLIT_SWING_LIMIT * 100}% in opposite directions, the volume/price split is marked unreliable rather than reported - a change in how CMS counted services, not a real shift.`,
    ],
    nextSignal: `Watch whether the types breaking from their history in ${latestYear.dataYear} do so again in ${latestYear.dataYear + 1} - two years in the same direction meets this framework's persistence rule for a trend.`,
    recommendedInternalValidation: "Compare the same specialty split against a plan's own professional claims, including its commercial and MA lines, which this data doesn't cover.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Medicare payment growth by provider type, ${priorYear.dataYear} to ${latestYear.dataYear}`,
      unit: "% change",
      bars: selected.map(({ row }) => ({ label: row.type, value: Math.round(row.split.payment * 1000) / 10 })),
    },
  });
}

async function stateGrowthInsight(years: PhysicianYearData[], ctx: AgentContext): Promise<Insight | null> {
  const latestYear = years[years.length - 1];
  const priorYear = years[years.length - 2];
  const fiveBack = years.length > 5 ? years[years.length - 6] : null;
  const latest = byState(latestYear);
  const prior = byState(priorYear);
  const older = fiveBack ? byState(fiveBack) : null;
  const national = growth(nationalTotals(latestYear).standardizedPayment, nationalTotals(priorYear).standardizedPayment);
  if (national === null) return null;

  const rows = [...latest.entries()]
    .map(([state, cur]) => {
      const g = growth(cur.standardizedPayment, prior.get(state)?.standardizedPayment ?? 0);
      const old = older?.get(state);
      const fiveYear = old && fiveBack ? cagr(cur.standardizedPayment, old.standardizedPayment, latestYear.dataYear - fiveBack.dataYear) : null;
      return g === null ? null : { state, cur, growth: g, fiveYear };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return null;

  const describe = (r: (typeof rows)[number]) =>
    `standardized payment ${pct(r.growth)} in ${latestYear.dataYear}${r.fiveYear !== null && fiveBack ? `, ${pct(r.fiveYear)} a year since ${fiveBack.dataYear}` : ""} (${billions(r.cur.standardizedPayment)})`;
  const candidates: Candidate[] = rows.map((r) => ({ id: r.state, label: r.state, summary: describe(r), primaryMetric: r.growth }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_STATES, taskDescription: `Medicare Part B standardized payment growth by state, ${priorYear.dataYear} to ${latestYear.dataYear}, against ${pct(national)} nationally` },
    ctx
  );
  const byStateCode = new Map(rows.map((r) => [r.state, r]));
  const selected = selections.map((s) => ({ row: byStateCode.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;

  const ranked = [...rows].sort((a, b) => b.growth - a.growth);
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-claims-cost-${latestYear.dataYear}-physician-state-growth`,
    headline: `${top.state} had the fastest growth in standardized Medicare Part B payment in ${latestYear.dataYear} (${pct(top.growth)}) and ${bottom.state} the slowest (${pct(bottom.growth)}), against ${pct(national)} nationally.`,
    questionId: "Q012",
    signalType: "baseline",
    period: { start: `${priorYear.dataYear}-01-01`, end: yearEnd(latestYear.dataYear) },
    population: "medicare-ffs",
    geography: { level: "state", code: "US-STATES", label: `${rows.length} states and DC` },
    magnitude: { value: top.growth * 100, unit: "percent", comparedTo: `national growth of ${pct(national)}` },
    drivers: [
      {
        description: `Standardized payment (CMS's payment with geographic price adjustments removed, so states compare fairly), every provider, by the provider's state: ${selected.map(({ row, rationale }) => `${row.state}: ${describe(row)}${source === "llm" ? ` - ${rationale}` : ""}`).join("; ")}.${source === "llm" ? ` Candidate selection method: model-reasoned salience ranking over all ${rows.length} states and DC.` : " Candidate selection method: deterministic ranking by growth."}`,
        supportingEvidenceIds: ["ev-phys-states"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Where Medicare professional spending is growing fastest once regional price differences are removed - a proxy for where utilization and intensity are rising.",
    evidence: [evidenceFor(years, "ev-phys-states")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Full-population state totals; a single year's state ranking is a baseline, not a trend.`,
    freshness: { dataAsOf: yearEnd(latestYear.dataYear), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "States are where the billing provider is located, not where the patient lives; a provider serving several states counts in one.",
      "Fee-for-service totals fall as more beneficiaries move to Medicare Advantage, so slow growth can reflect MA enrollment rather than lower use.",
    ],
    nextSignal: `Check whether the fastest-growing states in ${latestYear.dataYear} were also fast in prior years, using the 5-year rates above.`,
    recommendedInternalValidation: "Compare state-level growth against MA penetration in the same states before reading it as a utilization signal.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Standardized Medicare Part B payment growth by state, ${priorYear.dataYear} to ${latestYear.dataYear}`,
      unit: "% change",
      bars: selected.map(({ row }) => ({ label: row.state, value: Math.round(row.growth * 1000) / 10 })),
    },
  });
}

/** All physician-trend insights, or none when fewer than 2 data years are on disk. */
export async function buildPhysicianTrendInsights(years: PhysicianYearData[], ctx: AgentContext): Promise<Insight[]> {
  if (years.length < 2) return [];
  const insights = [nationalTrendInsight(years), await providerTypeGrowthInsight(years, ctx), await stateGrowthInsight(years, ctx)];
  return insights.filter((i): i is Insight => i !== null);
}
