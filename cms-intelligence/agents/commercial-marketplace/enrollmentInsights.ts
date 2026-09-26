/**
 * Marketplace enrollment insights from CMS's Open Enrollment state-level
 * files (data/adapters/marketplaceEnrollment.ts) - every state and DC,
 * HealthCare.gov and state-run exchanges alike, 2017 onward. These answer
 * Q066 (where enrollment is changing), which the rate files can't, and
 * test whether states where the premium after subsidy rose most lost the
 * most enrollees.
 *
 * States move between HealthCare.gov and their own exchanges, so platform
 * totals aren't comparable year to year; national figures here are the
 * all-platform total, and state figures compare each state with itself.
 */
import { loadAllOepYears, SOURCE_ID, stateRows, totalRow, valueOf, type OepRow, type OepYear } from "../../data/adapters/marketplaceEnrollment";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { criticalR, pearsonCorrelation } from "../../intelligence/metrics/metrics";
import { checkAgainstHistory } from "../../intelligence/metrics/physicianTrends";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence, directionOf, meetsPersistence } from "../../intelligence/trends/trend";
import type { AgentContext } from "../types";

const AGENT_ID = "commercial-marketplace-intelligence";
const TOP_N_STATES = 8;

const pct = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
const millions = (x: number) => `${(x / 1e6).toFixed(2)}M`;
const usd = (x: number) => `$${Math.round(x).toLocaleString()}`;
const planYearStart = (year: number) => `${year}-01-01`;
const planYearEnd = (year: number) => `${year}-12-31`;

const COMMON_LIMITATIONS = [
  "Plan selections during open enrollment, not effectuated enrollment: some people who pick a plan never pay the first premium, and people also enroll outside open enrollment.",
  "CMS publishes no state-level open enrollment file before 2017, so history starts there. 2017-2019 come from CMS's report workbooks, which carry fewer fields than the 2020+ files.",
  "CMS suppresses small cells and some state-run exchanges don't report every field; those are left out, never treated as zero.",
];

const evidenceFor = (years: OepYear[], id: string) => ({
  id,
  sourceId: SOURCE_ID,
  description: `CMS Marketplace Open Enrollment Period State-Level Public Use Files, ${years[0].planYear}-${years[years.length - 1].planYear}, all 50 states and DC`,
  datasetVintage: years[years.length - 1].pulledAt.slice(0, 10),
});

interface StateChangeRow {
  state: string;
  platform: string;
  consumers: number;
  priorConsumers: number;
  growth: number;
  netPremium: number | null;
  priorNetPremium: number | null;
  newConsumers: number | null;
}

function stateChangeRows(current: OepYear, prior: OepYear): StateChangeRow[] {
  const priorByState = new Map<string, OepRow>(stateRows(prior).map((r) => [r.state, r]));
  return stateRows(current).flatMap((r) => {
    const p = priorByState.get(r.state);
    const consumers = valueOf(current, r, "Cnsmr");
    const priorConsumers = p ? valueOf(prior, p, "Cnsmr") : null;
    if (!p || consumers === null || !priorConsumers) return [];
    return [
      {
        state: r.state,
        platform: r.platform,
        consumers,
        priorConsumers,
        growth: consumers / priorConsumers - 1,
        netPremium: valueOf(current, r, "Avg_Prm_Aftr_APTC"),
        priorNetPremium: valueOf(prior, p, "Avg_Prm_Aftr_APTC"),
        newConsumers: valueOf(current, r, "New_Cnsmr"),
      },
    ];
  });
}

/** Enrollment-weighted average of a per-state average, across states reporting it in both years. */
function weightedAverage(rows: StateChangeRow[], pick: (r: StateChangeRow) => [number | null, number]): number | null {
  let sum = 0;
  let weight = 0;
  for (const r of rows) {
    const [value, w] = pick(r);
    if (value === null) continue;
    sum += value * w;
    weight += w;
  }
  return weight > 0 ? sum / weight : null;
}

export async function enrollmentInsights(ctx: AgentContext): Promise<Insight[]> {
  const years = loadAllOepYears();
  if (years.length < 2) return [];
  const insights = [nationalTrendInsight(years), await stateChangeInsight(years, ctx), netPremiumInsight(years)];
  return insights.filter((i): i is Insight => i !== null);
}

function nationalTrendInsight(years: OepYear[]): Insight | null {
  const series = years.flatMap((y) => {
    const total = totalRow(y, "All");
    const value = total ? valueOf(y, total, "Cnsmr") : null;
    return value === null ? [] : [{ year: y.planYear, value }];
  });
  if (series.length < 2) return null;
  const latest = series[series.length - 1];
  const prior = series[series.length - 2];
  const growth = latest.value / prior.value - 1;
  const current = years[years.length - 1];
  const previous = years[years.length - 2];
  const rows = stateChangeRows(current, previous);
  const down = rows.filter((r) => r.growth < 0).length;
  const netNow = weightedAverage(rows, (r) => [r.priorNetPremium === null ? null : r.netPremium, r.consumers]);
  const netBefore = weightedAverage(rows, (r) => [r.netPremium === null ? null : r.priorNetPremium, r.priorConsumers]);
  const allNow = totalRow(current, "All");
  const allBefore = totalRow(previous, "All");
  const newNow = allNow ? valueOf(current, allNow, "New_Cnsmr") : null;
  const newBefore = allBefore ? valueOf(previous, allBefore, "New_Cnsmr") : null;
  const check = checkAgainstHistory(series.map((p) => p.value));
  const directions = series.slice(1).map((p, i) => directionOf(p.value, series[i].value));
  const persistent = meetsPersistence(directions);
  const confidence = classifyConfidence({ persistenceMet: persistent, hasFullBaseline: true, hasExternalCorroboration: false });
  const peak = series.reduce((a, b) => (b.value > a.value ? b : a));

  return validateInsight({
    id: `sig-marketplace-${latest.year}-enrollment-trend`,
    headline: `Marketplace plan selections ${growth < 0 ? "fell" : "rose"} ${pct(Math.abs(growth)).slice(1)} to ${millions(latest.value)} in the ${latest.year} open enrollment, from ${millions(prior.value)}, and ${growth < 0 ? "fell" : "rose"} in ${growth < 0 ? down : rows.length - down} of ${rows.length} states; since ${series[0].year} they went from ${millions(series[0].value)}.`,
    questionId: "Q066",
    signalType: check?.anomalous ? "anomaly" : persistent ? "trend" : "baseline",
    period: { start: planYearStart(series[0].year), end: planYearEnd(latest.year) },
    population: "marketplace",
    geography: { level: "national", code: "US", label: "All 50 states and DC" },
    magnitude: { value: growth * 100, unit: "percent", comparedTo: `${prior.year} open enrollment plan selections`, delta: latest.value - prior.value },
    drivers: [
      {
        description: `Plan selections across HealthCare.gov and state-run exchanges: ${series.map((p) => `${p.year} ${millions(p.value)}`).join(", ")}${peak.year !== latest.year ? ` (peak ${peak.year})` : ""}. The ${latest.year} change ${check ? `${check.anomalous ? "breaks from" : "is in line with"} the ${series[0].year}-${prior.year} pattern (median yearly change ${pct(check.medianGrowth)})` : "can't yet be judged against its own history"}.${newNow !== null && newBefore ? ` New consumers: ${millions(newBefore)} to ${millions(newNow)} (${pct(newNow / newBefore - 1)}).` : ""}${netNow !== null && netBefore !== null ? ` Average monthly premium after subsidy, enrollment-weighted across states reporting it: ${usd(netBefore)} to ${usd(netNow)} (${pct(netNow / netBefore - 1)}).` : ""}`,
        supportingEvidenceIds: ["ev-oep-national"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Marketplace enrollment is the size of the individual-market opportunity for every exchange issuer; a national decline after years of growth changes membership forecasts and risk-pool assumptions.",
    evidence: [evidenceFor(years, "ev-oep-national")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} CMS's own count of every plan selection, ${series.length} open enrollment periods.`,
    freshness: { dataAsOf: current.pulledAt.slice(0, 10), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [...COMMON_LIMITATIONS, "Open enrollment counts don't say why people left; the premium-after-subsidy change is shown alongside, not proven as the cause."],
    nextSignal: `CMS's effectuated enrollment report for early ${latest.year} will show how many of these selections became paid coverage.`,
    recommendedInternalValidation: "Compare against a plan's own open enrollment membership change in the same states.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: {
      label: "Marketplace open enrollment plan selections, all states and DC",
      unit: "consumers",
      points: series.map((p) => ({ date: planYearStart(p.year), value: p.value })),
    },
  });
}

async function stateChangeInsight(years: OepYear[], ctx: AgentContext): Promise<Insight | null> {
  const current = years[years.length - 1];
  const previous = years[years.length - 2];
  const rows = stateChangeRows(current, previous);
  if (rows.length === 0) return null;
  const describe = (r: StateChangeRow) =>
    `${r.priorConsumers.toLocaleString()} to ${r.consumers.toLocaleString()} plan selections (${pct(r.growth)}, ${r.platform === "SBE" ? "state-run exchange" : "HealthCare.gov"})${r.netPremium !== null && r.priorNetPremium !== null ? `; average premium after subsidy ${usd(r.priorNetPremium)} to ${usd(r.netPremium)}` : ""}`;
  const candidates: Candidate[] = rows.map((r) => ({ id: r.state, label: r.state, summary: describe(r), primaryMetric: r.growth }));
  const { selections, source } = await selectNoteworthy(
    {
      candidates,
      topN: TOP_N_STATES,
      taskDescription: `Marketplace open enrollment plan selection change by state, ${previous.planYear} to ${current.planYear}`,
      // A fall in enrollment is the risk signal; the model may still pick standout growth.
      direction: "lowest",
    },
    ctx
  );
  const byState = new Map(rows.map((r) => [r.state, r]));
  const selected = selections.map((s) => ({ row: byState.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;

  const ranked = [...rows].sort((a, b) => a.growth - b.growth);
  const worst = ranked[0];
  const best = ranked[ranked.length - 1];
  const largestLoss = [...rows].sort((a, b) => a.consumers - a.priorConsumers - (b.consumers - b.priorConsumers))[0];
  const byPlatform = (platform: string) => {
    const group = rows.filter((r) => r.platform === platform);
    const before = group.reduce((n, r) => n + r.priorConsumers, 0);
    const now = group.reduce((n, r) => n + r.consumers, 0);
    return { count: group.length, growth: before > 0 ? now / before - 1 : null };
  };
  const hc = byPlatform("HC.gov");
  const sbe = byPlatform("SBE");
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-marketplace-${current.planYear}-enrollment-by-state`,
    headline: `${worst.state} had the steepest ${current.planYear} Marketplace enrollment change (${pct(worst.growth)}) and ${best.state} the strongest (${pct(best.growth)}); ${largestLoss.consumers < largestLoss.priorConsumers ? `${largestLoss.state} lost the most people, ${(largestLoss.priorConsumers - largestLoss.consumers).toLocaleString()}.` : "no state lost enrollees."}`,
    questionId: "Q066",
    signalType: "baseline",
    period: { start: planYearStart(previous.planYear), end: planYearEnd(current.planYear) },
    population: "marketplace",
    geography: { level: "state", code: "US-STATES", label: `${rows.length} states and DC` },
    magnitude: { value: worst.growth * 100, unit: "percent", comparedTo: `${worst.state} ${previous.planYear} plan selections` },
    drivers: [
      {
        description: `Plan selections by state, each on the platform it used in ${current.planYear}: ${selected.map(({ row, rationale }) => `${row.state}: ${describe(row)}${source === "llm" ? ` - ${rationale}` : ""}`).join("; ")}.${hc.growth !== null && sbe.growth !== null ? ` States on HealthCare.gov in ${current.planYear} changed ${pct(hc.growth)} together (${hc.count} states); states running their own exchange ${pct(sbe.growth)} (${sbe.count} including DC).` : ""}${source === "llm" ? ` Candidate selection method: model-reasoned salience ranking over all ${rows.length} states and DC.` : " Candidate selection method: deterministic ranking, largest declines first."}`,
        supportingEvidenceIds: ["ev-oep-states"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Where exchange membership is growing or shrinking fastest - the states where issuers' individual-market volume, and the pool's average risk, are shifting most.",
    evidence: [evidenceFor(years, "ev-oep-states")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} CMS's count of every plan selection in each state; one year's state ranking is a baseline, not a trend.`,
    freshness: { dataAsOf: current.pulledAt.slice(0, 10), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "A state that moved to its own exchange is compared with its own prior total, but state-run exchanges can run longer open enrollment periods than HealthCare.gov, which can lift their counts.",
    ],
    nextSignal: `Check whether the states that lost the most enrollees in ${current.planYear} also lost issuers (see the issuer participation insight).`,
    recommendedInternalValidation: "Compare against a plan's own membership change by state.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Marketplace plan selection change by state, ${previous.planYear} to ${current.planYear}`,
      unit: "% change",
      bars: selected.map(({ row }) => ({ label: row.state, value: Math.round(row.growth * 1000) / 10 })).sort((a, b) => a.value - b.value),
    },
  });
}

function netPremiumInsight(years: OepYear[]): Insight | null {
  const current = years[years.length - 1];
  const previous = years[years.length - 2];
  const rows = stateChangeRows(current, previous).filter(
    (r): r is StateChangeRow & { netPremium: number; priorNetPremium: number } => r.netPremium !== null && r.priorNetPremium !== null && r.priorNetPremium > 0
  );
  if (rows.length < 10) return null;
  const points = rows.map((r) => ({ state: r.state, premiumChange: r.netPremium / r.priorNetPremium - 1, enrollmentChange: r.growth }));
  const r = pearsonCorrelation(
    points.map((p) => p.premiumChange),
    points.map((p) => p.enrollmentChange)
  );
  const threshold = criticalR(points.length);
  const significant = Math.abs(r) > threshold;
  const medianPremiumChange = [...points].sort((a, b) => a.premiumChange - b.premiumChange)[Math.floor(points.length / 2)].premiumChange;
  const steepest = [...points].sort((a, b) => b.premiumChange - a.premiumChange).slice(0, 3);
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-marketplace-${current.planYear}-net-premium-vs-enrollment`,
    headline: `The average Marketplace premium after subsidy changed ${pct(medianPremiumChange)} in the median state for ${current.planYear}; across ${points.length} states, larger increases ${significant ? `${Math.abs(r) < 0.5 ? "weakly " : ""}${r < 0 ? "went with larger enrollment losses" : "went with enrollment gains"}` : "did not clearly track enrollment change"} (correlation ${r.toFixed(2)}).`,
    questionId: "Q067",
    signalType: "baseline",
    period: { start: planYearStart(previous.planYear), end: planYearEnd(current.planYear) },
    population: "marketplace",
    geography: { level: "state", code: "US-STATES", label: `${points.length} states and DC reporting net premiums` },
    magnitude: { value: r, unit: "pearson-r", comparedTo: `significance threshold of about ${threshold.toFixed(2)} for ${points.length} states` },
    drivers: [
      {
        description: `Average monthly premium after the premium tax credit, per state, against the change in plan selections, ${previous.planYear} to ${current.planYear}. With ${points.length} states, a correlation beyond about ${threshold.toFixed(2)} in either direction is unlikely by chance (p < 0.05); this one is ${r.toFixed(2)}. Largest increases after subsidy: ${steepest.map((p) => `${p.state} ${pct(p.premiumChange)} (enrollment ${pct(p.enrollmentChange)})`).join("; ")}.`,
        supportingEvidenceIds: ["ev-oep-net-premium"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "What enrollees actually pay after subsidy drives who stays covered; a strong link between net-premium increases and enrollment losses marks the states where price sensitivity, and the risk of healthier members leaving, is highest.",
    evidence: [evidenceFor(years, "ev-oep-net-premium")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} A cross-state correlation for one year, not evidence that the price change caused the enrollment change.`,
    freshness: { dataAsOf: current.pulledAt.slice(0, 10), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "The average premium after subsidy also shifts when the mix of who enrolls changes (for example, if lower-income enrollees with the largest subsidies leave), not only when prices change.",
      "Correlation across states, not a causal estimate.",
    ],
    nextSignal: `Watch whether the same states lose enrollment again in ${current.planYear + 1}; a second year in the same direction meets the persistence rule for a trend.`,
    recommendedInternalValidation: "Compare against a plan's own lapse and non-renewal rates by net-premium change.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "scatter",
      title: `Change in premium after subsidy vs. change in plan selections, by state, ${previous.planYear} to ${current.planYear}`,
      xLabel: "Average premium after subsidy, % change",
      yLabel: "Plan selections, % change",
      xUnit: "%",
      yUnit: "%",
      points: points.map((p) => ({ label: p.state, x: Math.round(p.premiumChange * 1000) / 10, y: Math.round(p.enrollmentChange * 1000) / 10 })),
    },
  });
}
