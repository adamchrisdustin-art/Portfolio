/**
 * Commercial / Marketplace Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 8.
 *
 * Rebuilt 2026-09-25 on the full plan-year summaries
 * (data/adapters/marketplaceRatePuf.ts): every HealthCare.gov state,
 * every plan year from 2014, individual-market medical plans only. The
 * 5-state sample it replaced mixed stand-alone dental plans into its
 * premium medians and dropped tobacco-rated plans; see the adapter header.
 *
 * Insights:
 * - Benchmark premium trend (Q067): the second-lowest-cost silver premium
 *   for a 40-year-old, the plan subsidies are pegged to, over every year.
 * - Benchmark change by state (Q067), with the salience layer choosing
 *   which states to show.
 * - Deductible trend (Q069): silver and bronze deductibles.
 * - Issuer participation (Q071): issuer entry and exit by state, counted by
 *   opaque HIOS id, never named.
 * - Enrollment (Q066) and premium after subsidy against enrollment, from
 *   CMS's Open Enrollment state-level files, every state and DC
 *   (enrollmentInsights.ts, added 2026-09-25).
 *
 * Every comparison is like-for-like: series use states present in every
 * year, and year-over-year changes use states present in both years
 * (intelligence/metrics/marketplaceTrends.ts).
 */
import { loadAllPlanYears, REFERENCE_AGE, SOURCE_ID, type MarketplaceYearSummary } from "../../data/adapters/marketplaceRatePuf";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { coverageChanges, issuerFlows, panelSeries, panelStates, stateChanges, type StateChange } from "../../intelligence/metrics/marketplaceTrends";
import { checkAgainstHistory, type HistoryCheck } from "../../intelligence/metrics/physicianTrends";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence, directionOf, meetsPersistence } from "../../intelligence/trends/trend";
import type { AgentContext, DomainAgent } from "../types";
import { enrollmentInsights } from "./enrollmentInsights";

const AGENT_ID = "commercial-marketplace-intelligence";
const TOP_N_STATES = 8;

const pct = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
const usd = (x: number) => `$${Math.round(x).toLocaleString()}`;
const signedUsd = (x: number) => `${x >= 0 ? "+" : "-"}$${Math.abs(Math.round(x)).toLocaleString()}`;
const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const planYearStart = (year: number) => `${year}-01-01`;
const planYearEnd = (year: number) => `${year}-12-31`;

const evidenceFor = (years: MarketplaceYearSummary[], id: string) => {
  const latest = years[years.length - 1];
  return {
    id,
    sourceId: SOURCE_ID,
    description: `CMS Marketplace Rate and Plan Attributes PUFs, plan years ${years[0].planYear}-${latest.planYear}, every HealthCare.gov state (${latest.states.length} in ${latest.planYear}), individual-market medical plans, summarized at pull time`,
    datasetVintage: latest.pulledAt.slice(0, 10),
  };
};

const COMMON_LIMITATIONS = [
  "HealthCare.gov states only: states running their own exchange (including CA, NY, WA, PA, NJ, IL and GA in recent years) are not in CMS's federal files, and the set changes as states leave. Every comparison uses only states present in the years compared.",
  "Filed list premiums before subsidies; most enrollees receive a premium tax credit that lowers what they pay.",
  "No enrollment in these files, so every median is across plans or rating areas, not weighted by how many people bought them.",
];

function historyNote(check: HistoryCheck | null, first: number, prior: number): string {
  if (!check) return "can't yet be judged against its own history (too few years)";
  return `${check.anomalous ? "breaks from" : "is in line with"} its own ${first}-${prior} pattern (median yearly change ${pct(check.medianGrowth)})`;
}

export const commercialMarketplaceAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: ["Q066", "Q067", "Q068", "Q069", "Q070", "Q071", "Q072"],

  async run(ctx: AgentContext): Promise<Insight[]> {
    const years = loadAllPlanYears();
    const rateInsights = years.length < 2 ? [] : [benchmarkTrendInsight(years), await benchmarkStateInsight(years, ctx), deductibleInsight(years), await issuerInsight(years, ctx)];
    return [...rateInsights.filter((i): i is Insight => i !== null), ...(await enrollmentInsights(ctx))];
  },
};

function benchmarkTrendInsight(years: MarketplaceYearSummary[]): Insight | null {
  const latest = years[years.length - 1];
  const prior = years[years.length - 2];
  const panel = panelStates(years);
  const series = panelSeries(years, "benchmarkMedian", panel);
  const silver = stateChanges(latest, prior, "benchmarkMedian").filter((c) => c.growth !== null);
  const bronze = stateChanges(latest, prior, "lowestBronzeMedian").filter((c) => c.growth !== null);
  if (silver.length === 0 || series.length < 2) return null;

  const silverGrowth = median(silver.map((c) => c.growth!));
  const bronzeGrowth = bronze.length ? median(bronze.map((c) => c.growth!)) : null;
  const rose = silver.filter((c) => c.growth! > 0).length;
  const check = checkAgainstHistory(series.map((p) => p.value));
  const directions = series.slice(1).map((p, i) => directionOf(p.value, series[i].value));
  const persistent = meetsPersistence(directions);
  const confidence = classifyConfidence({ persistenceMet: persistent, hasFullBaseline: true, hasExternalCorroboration: false });
  const { left, joined } = coverageChanges(latest, prior);
  const latestPanel = series[series.length - 1];
  // The largest earlier yearly change, so the latest one reads in context.
  const changes = series.slice(1).map((p, i) => ({ year: p.year, growth: p.value / series[i].value - 1 }));
  const largestEarlier = changes.slice(0, -1).reduce((a, b) => (Math.abs(b.growth) > Math.abs(a.growth) ? b : a), changes[0]);

  return validateInsight({
    id: `sig-marketplace-${latest.planYear}-benchmark-trend`,
    headline: `The benchmark silver premium for a 40-year-old changed ${pct(silverGrowth)} for plan year ${latest.planYear} in the median HealthCare.gov state (rising in ${rose} of ${silver.length} states); the lowest-cost bronze premium changed ${bronzeGrowth === null ? "by an unknown amount" : pct(bronzeGrowth)}.`,
    questionId: "Q067",
    signalType: check?.anomalous ? "anomaly" : persistent ? "trend" : "baseline",
    period: { start: planYearStart(series[0].year), end: planYearEnd(latest.planYear) },
    population: "marketplace",
    geography: { level: "state", code: "US-FFM", label: `${silver.length} HealthCare.gov states` },
    magnitude: { value: silverGrowth * 100, unit: "percent", comparedTo: `${prior.planYear} benchmark premium, same states` },
    drivers: [
      {
        description: `Benchmark = the second-lowest-cost silver plan in each rating area at age ${REFERENCE_AGE}, the plan the premium tax credit is pegged to; each state's value is the median across its rating areas. Across the ${panel.length} states on HealthCare.gov in every year since ${series[0].year}, the median benchmark went from ${usd(series[0].value)} to ${usd(latestPanel.value)} a month; the ${latest.planYear} change ${historyNote(check, series[0].year, prior.planYear)}. The largest earlier yearly change was ${pct(largestEarlier.growth)} in ${largestEarlier.year}.${bronzeGrowth !== null ? ` Silver moving ${Math.abs(silverGrowth - bronzeGrowth) >= 0.05 ? "well apart from" : "with"} bronze (${pct(silverGrowth)} vs ${pct(bronzeGrowth)}) ${Math.abs(silverGrowth - bronzeGrowth) >= 0.05 ? "points to pricing specific to silver plans" : "points to market-wide pricing"}.` : ""}${left.length ? ` Left HealthCare.gov for their own exchange this year, and excluded: ${left.join(", ")}.` : ""}${joined.length ? ` Newly on HealthCare.gov: ${joined.join(", ")}.` : ""}`,
        supportingEvidenceIds: ["ev-marketplace-benchmark"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "The benchmark premium sets subsidy amounts for most Marketplace enrollees and is the standard yardstick for exchange pricing; its year-over-year change is the headline premium signal for plan pricing and competitive positioning.",
    evidence: [evidenceFor(years, "ev-marketplace-benchmark")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Every plan in every HealthCare.gov state for ${years.length} plan years, not a sample.`,
    freshness: { dataAsOf: latest.pulledAt.slice(0, 10), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "Benchmarks are computed per rating area; the official benchmark is set per county, and not every plan in a rating area serves every county in it.",
      "State values are medians across rating areas, not population-weighted.",
    ],
    nextSignal: `CMS publishes plan year ${latest.planYear + 1} files in the fall; watch whether the benchmark keeps moving in the same direction.`,
    recommendedInternalValidation: "Compare against a plan's own filed rate change for the same states and year.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: {
      label: `Median benchmark silver premium, age ${REFERENCE_AGE}, ${panel.length} states on HealthCare.gov every year`,
      unit: "usd/month",
      points: series.map((p) => ({ date: planYearStart(p.year), value: Math.round(p.value * 100) / 100 })),
    },
  });
}

async function benchmarkStateInsight(years: MarketplaceYearSummary[], ctx: AgentContext): Promise<Insight | null> {
  const latest = years[years.length - 1];
  const prior = years[years.length - 2];
  const rows = stateChanges(latest, prior, "benchmarkMedian").filter((c): c is StateChange & { growth: number } => c.growth !== null);
  if (rows.length === 0) return null;
  const fiveBack = years.length > 5 ? years[years.length - 6] : null;
  const longRun = fiveBack ? new Map(stateChanges(latest, fiveBack, "benchmarkMedian").map((c) => [c.state, c])) : new Map<string, StateChange>();
  const national = median(rows.map((r) => r.growth));

  const describe = (r: (typeof rows)[number]) => {
    const five = longRun.get(r.state);
    return `benchmark ${usd(r.prior)} to ${usd(r.current)} a month (${pct(r.growth)})${five?.growth != null && fiveBack ? `; ${pct(five.growth)} since ${fiveBack.planYear}` : ""}`;
  };
  const candidates: Candidate[] = rows.map((r) => ({ id: r.state, label: r.state, summary: describe(r), primaryMetric: r.growth }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_STATES, taskDescription: `Marketplace benchmark silver premium change by state, plan year ${prior.planYear} to ${latest.planYear}, against a median state change of ${pct(national)}` },
    ctx
  );
  const byState = new Map(rows.map((r) => [r.state, r]));
  const selected = selections.map((s) => ({ row: byState.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;

  const ranked = [...rows].sort((a, b) => b.growth - a.growth);
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const priciest = [...latest.states].filter((s) => s.benchmarkMedian !== null).sort((a, b) => b.benchmarkMedian! - a.benchmarkMedian!);
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-marketplace-${latest.planYear}-benchmark-by-state`,
    headline: `${top.state} had the largest benchmark premium change for plan year ${latest.planYear} (${pct(top.growth)}) and ${bottom.state} the smallest (${pct(bottom.growth)}); ${priciest[0].state} has the highest benchmark at ${usd(priciest[0].benchmarkMedian!)} a month for a 40-year-old.`,
    questionId: "Q067",
    signalType: "baseline",
    period: { start: planYearStart(prior.planYear), end: planYearEnd(latest.planYear) },
    population: "marketplace",
    geography: { level: "state", code: "US-FFM", label: `${rows.length} HealthCare.gov states` },
    magnitude: { value: top.growth * 100, unit: "percent", comparedTo: `median state change of ${pct(national)}` },
    drivers: [
      {
        description: `Benchmark silver premium at age ${REFERENCE_AGE}, median across each state's rating areas: ${selected.map(({ row, rationale }) => `${row.state}: ${describe(row)}${source === "llm" ? ` - ${rationale}` : ""}`).join("; ")}. Highest ${latest.planYear} benchmarks: ${priciest.slice(0, 3).map((s) => `${s.state} ${usd(s.benchmarkMedian!)}`).join(", ")}; lowest: ${priciest.slice(-3).reverse().map((s) => `${s.state} ${usd(s.benchmarkMedian!)}`).join(", ")}.${source === "llm" ? ` Candidate selection method: model-reasoned salience ranking over all ${rows.length} states.` : " Candidate selection method: deterministic ranking by change."}`,
        supportingEvidenceIds: ["ev-marketplace-states"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Where exchange premiums are rising fastest - the states where pricing pressure, and the subsidy cost that follows the benchmark, is concentrated.",
    evidence: [evidenceFor(years, "ev-marketplace-states")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Every plan in each state; one year's state ranking is a baseline, not a trend.`,
    freshness: { dataAsOf: latest.pulledAt.slice(0, 10), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [...COMMON_LIMITATIONS, "Small states have one or a few rating areas and few issuers, so one issuer's rate change can move the state's benchmark."],
    nextSignal: `Check whether the states with the largest ${latest.planYear} increases also lost issuers (see the issuer participation insight).`,
    recommendedInternalValidation: "Compare against a plan's own rate filings in the same states.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Benchmark silver premium change by state, plan year ${prior.planYear} to ${latest.planYear}`,
      unit: "% change",
      bars: selected.map(({ row }) => ({ label: row.state, value: Math.round(row.growth * 1000) / 10 })),
    },
  });
}

function deductibleInsight(years: MarketplaceYearSummary[]): Insight | null {
  const latest = years[years.length - 1];
  const prior = years[years.length - 2];
  const panel = panelStates(years);
  const silverSeries = panelSeries(years, "silverDeductibleMedian", panel);
  const bronzeSeries = panelSeries(years, "bronzeDeductibleMedian", panel);
  const silver = stateChanges(latest, prior, "silverDeductibleMedian");
  const bronze = stateChanges(latest, prior, "bronzeDeductibleMedian");
  if (silver.length === 0 || silverSeries.length < 2) return null;

  const silverChange = median(silver.map((c) => c.change));
  const bronzeChange = bronze.length ? median(bronze.map((c) => c.change)) : null;
  const silverNow = median(silver.map((c) => c.current));
  const moved = [...silver].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 5);
  const directions = silverSeries.slice(1).map((p, i) => directionOf(p.value, silverSeries[i].value));
  const persistent = meetsPersistence(directions);
  const confidence = classifyConfidence({ persistenceMet: persistent, hasFullBaseline: true, hasExternalCorroboration: false });
  const first = silverSeries[0];
  const last = silverSeries[silverSeries.length - 1];

  return validateInsight({
    id: `sig-marketplace-${latest.planYear}-deductible-trend`,
    headline: `The median silver-plan deductible in HealthCare.gov states is ${usd(silverNow)} for plan year ${latest.planYear}, ${signedUsd(silverChange)} from ${prior.planYear} in the median state${bronzeChange !== null ? ` (bronze ${signedUsd(bronzeChange)})` : ""}; in the states on HealthCare.gov since ${first.year} it went from ${usd(first.value)} to ${usd(last.value)}.`,
    questionId: "Q069",
    signalType: persistent ? "trend" : "baseline",
    period: { start: planYearStart(first.year), end: planYearEnd(latest.planYear) },
    population: "marketplace",
    geography: { level: "state", code: "US-FFM", label: `${silver.length} HealthCare.gov states` },
    magnitude: { value: silverChange, unit: "usd", comparedTo: `${prior.planYear} median silver deductible, same states` },
    drivers: [
      {
        description: `In-network individual deductible of each on-exchange plan's standard version (the combined medical and drug deductible where the plan has one), median across a state's plans. Largest ${latest.planYear} silver changes: ${moved.map((c) => `${c.state} ${usd(c.prior)} to ${usd(c.current)}`).join("; ")}. Bronze median across the same ${panel.length}-state panel: ${bronzeSeries.length ? `${usd(bronzeSeries[0].value)} in ${bronzeSeries[0].year} to ${usd(bronzeSeries[bronzeSeries.length - 1].value)}` : "not available"}.`,
        supportingEvidenceIds: ["ev-marketplace-deductibles"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Deductibles are the affordability signal the premium doesn't show: a lower premium bought with a higher deductible shifts cost to members at the point of care.",
    evidence: [evidenceFor(years, "ev-marketplace-deductibles")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Every on-exchange plan's filed deductible, ${years.length} plan years.`,
    freshness: { dataAsOf: latest.pulledAt.slice(0, 10), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "Standard plan versions only: lower-income enrollees in cost-sharing-reduction silver variants have much lower deductibles.",
      "Deductibles are medians across plans offered, not what enrollees chose.",
    ],
    nextSignal: `Watch whether plan year ${latest.planYear + 1} deductibles move with or against premiums - a premium cut paired with a deductible rise is a benefit buy-down, not cheaper coverage.`,
    recommendedInternalValidation: "Compare against a plan's own metal-level benefit designs in the same states.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: {
      label: `Median silver deductible, ${panel.length} states on HealthCare.gov every year`,
      unit: "usd",
      points: silverSeries.map((p) => ({ date: planYearStart(p.year), value: p.value })),
    },
  });
}

async function issuerInsight(years: MarketplaceYearSummary[], ctx: AgentContext): Promise<Insight | null> {
  const latest = years[years.length - 1];
  const prior = years[years.length - 2];
  const flows = issuerFlows(latest, prior);
  if (flows.length === 0) return null;
  const entered = flows.reduce((n, f) => n + f.entered, 0);
  const exited = flows.reduce((n, f) => n + f.exited, 0);
  const panel = new Set(panelStates(years));
  const participation = years.map((y) => ({ year: y.planYear, value: y.states.filter((s) => panel.has(s.state)).reduce((n, s) => n + s.issuerIds.length, 0) }));
  const singleIssuerAreas = latest.ratingAreas.filter((a) => a.issuers === 1);

  const describe = (f: (typeof flows)[number]) => `${f.issuers} issuer(s), ${f.priorIssuers} in ${prior.planYear} (${f.entered} entered, ${f.exited} left)`;
  const candidates: Candidate[] = flows.map((f) => ({ id: f.state, label: f.state, summary: describe(f), primaryMetric: f.issuers }));
  const { selections, source } = await selectNoteworthy(
    {
      candidates,
      topN: TOP_N_STATES,
      taskDescription: `Marketplace issuer participation by state, plan year ${latest.planYear}, with entry and exit since ${prior.planYear}`,
      // Fewer issuers is the competitive-intensity signal worth an executive's attention.
      direction: "lowest",
    },
    ctx
  );
  const byState = new Map(flows.map((f) => [f.state, f]));
  const selected = selections.map((s) => ({ row: byState.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;

  const netLosers = flows.filter((f) => f.issuers < f.priorIssuers).sort((a, b) => a.issuers - a.priorIssuers - (b.issuers - b.priorIssuers));
  const fewest = [...flows].sort((a, b) => a.issuers - b.issuers)[0];
  const most = [...flows].sort((a, b) => b.issuers - a.issuers)[0];
  const peak = participation.reduce((a, b) => (b.value > a.value ? b : a));
  const trough = participation.reduce((a, b) => (b.value < a.value ? b : a));
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-marketplace-${latest.planYear}-issuer-participation`,
    headline: `${exited} issuer exits and ${entered} entries across ${flows.length} HealthCare.gov states for plan year ${latest.planYear}; issuers per state range from ${fewest.issuers} in ${fewest.state} to ${most.issuers} in ${most.state}.`,
    questionId: "Q071",
    signalType: exited > entered ? "structural-change" : "baseline",
    period: { start: planYearStart(prior.planYear), end: planYearEnd(latest.planYear) },
    population: "marketplace",
    geography: { level: "state", code: "US-FFM", label: `${flows.length} HealthCare.gov states` },
    magnitude: { value: entered - exited, unit: "issuers (net)", comparedTo: `${prior.planYear} issuer participation, same states` },
    drivers: [
      {
        description: `Issuers with an on-exchange medical plan in each state, matched year to year by CMS issuer id: ${selected.map(({ row, rationale }) => `${row.state}: ${describe(row)}${source === "llm" ? ` - ${rationale}` : ""}`).join("; ")}.${netLosers.length ? ` Net losses: ${netLosers.slice(0, 5).map((f) => `${f.state} ${f.priorIssuers} to ${f.issuers}`).join(", ")}.` : ""} ${singleIssuerAreas.length} of ${latest.ratingAreas.length} rating areas ${singleIssuerAreas.length === 1 ? "has" : "have"} a single issuer. State-issuer pairs across the ${panel.size} states on HealthCare.gov every year: ${trough.value} at the ${trough.year} low, ${peak.value} at the ${peak.year} high, ${participation[participation.length - 1].value} in ${latest.planYear}.${source === "llm" ? ` Candidate selection method: model-reasoned salience ranking over all ${flows.length} states.` : " Candidate selection method: deterministic ranking, fewest issuers first."}`,
        supportingEvidenceIds: ["ev-marketplace-issuers"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Issuer entry and exit is the clearest read on exchange competitive intensity: exits leave fewer choices and tend to precede premium increases, and entries mark markets issuers see as profitable.",
    evidence: [evidenceFor(years, "ev-marketplace-issuers")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Every filed issuer in each state; counts, not market shares.`,
    freshness: { dataAsOf: latest.pulledAt.slice(0, 10), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "An issuer that files under a new HIOS id (after a merger or restructuring) counts as one exit and one entry.",
      "Issuers are counted, never named, and without enrollment an exit by a small issuer counts the same as one by a large issuer.",
    ],
    nextSignal: `Plan year ${latest.planYear + 1} filings will show whether the ${latest.planYear} exits continue.`,
    recommendedInternalValidation: "Not applicable - public filing data, not tied to any payer's book of business.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Marketplace issuers per state, plan year ${latest.planYear} (fewest first)`,
      unit: "issuers",
      bars: selected.map(({ row }) => ({ label: row.state, value: row.issuers })).sort((a, b) => a.value - b.value),
    },
    series: {
      label: `Issuer participations (state-issuer pairs), ${panel.size} states on HealthCare.gov every year`,
      unit: "issuers",
      points: participation.map((p) => ({ date: planYearStart(p.year), value: p.value })),
    },
  });
}
