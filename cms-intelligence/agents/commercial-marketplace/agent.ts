/**
 * Commercial / Marketplace Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 8.
 *
 * Wired 2026-09-23 to the third and final item in Adam's data-source
 * priority order: CMS's Health Insurance Exchange (Marketplace) Rate
 * PUF (see cms-intelligence/data/adapters/marketplaceRatePuf.ts for how
 * it was verified live, why WA/CA/NY couldn't be reused from this
 * project's usual 5-state sample, and the naming/privacy design
 * decision). No enrollment data exists in this file family (Q066 stays
 * unaddressed - see SOURCE_REGISTRY.md); this agent covers premium
 * distribution (Q067) and plan-availability/competitive-intensity
 * (Q071) from real data.
 *
 * DATA-QUALITY JUDGMENT (disclosed, not officially confirmed): this
 * pull's real 5-state/age-21/tobacco-neutral sample contains 67 rows at
 * exactly IndividualRate=9999 and 1,129 rows at exactly 0 - both
 * statistical outliers wildly inconsistent with the rest of the
 * distribution. The real CMS Rate PUF data dictionary (verified
 * 2026-09-23) does NOT document either as an official sentinel/
 * placeholder value - IndividualRate is documented only as "Free Text."
 * This agent excludes both as a disclosed empirical judgment (not an
 * official CMS convention), same as every other agent's own materiality
 * thresholds - see EXCLUDED_RATE_CEILING/EXCLUDED_RATE_FLOOR below.
 *
 * Second use of the salience/triage reasoning layer
 * (intelligence/salience/selectNoteworthy.ts) - the plan-availability
 * insight computes real distinct-issuer-counts for every sampled state,
 * then lets the same deterministic-fallback/model-reasoned selection
 * choose which are noteworthy.
 *
 * REDESIGNED 2026-09-24 (real bug, caught from Adam's screenshot): the
 * plan-availability insight originally ranked distinct-PlanId counts per
 * RATING AREA, which produced a degenerate, tie-dominated ranking (9
 * South Carolina rating areas tied at exactly 27) because issuers file
 * consistently across every rating area they enter within a state -
 * rating area isn't where this data's real variation lives. Redesigned
 * to count distinct real IssuerId values (added to the adapter the same
 * day - previously dropped entirely) aggregated to the STATE level,
 * which shows genuine, non-tied variation (7 to 18 issuers across the 5
 * sampled states) and better matches Q071's own catalog wording ("number
 * of ISSUERS/plans"). IssuerId is still never surfaced as a name - only
 * ever used as a COUNT, same discipline as PlanId.
 */
import { loadLatestSnapshot, SOURCE_ID, type MarketplaceRateRow } from "../../data/adapters/marketplaceRatePuf";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { tukeyBox } from "../../intelligence/metrics/metrics";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence } from "../../intelligence/trends/trend";
import type { AgentContext, DomainAgent } from "../types";

const AGENT_ID = "commercial-marketplace-intelligence";
const EXCLUDED_RATE_FLOOR = 0; // see file header - a disclosed empirical judgment, not an official CMS convention
const EXCLUDED_RATE_CEILING = 9999; // ditto
const MIN_ROWS_FOR_BOXPLOT = 20;

function baselineConfidence() {
  return classifyConfidence({ persistenceMet: false, hasFullBaseline: false, hasExternalCorroboration: false });
}

function plausibleRows(rows: MarketplaceRateRow[]): MarketplaceRateRow[] {
  return rows.filter((r) => r.individualRate > EXCLUDED_RATE_FLOOR && r.individualRate < EXCLUDED_RATE_CEILING);
}

export const commercialMarketplaceAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: ["Q066", "Q067", "Q068", "Q069", "Q070", "Q071", "Q072"],

  async run(ctx: AgentContext): Promise<Insight[]> {
    const snapshot = loadLatestSnapshot();
    if (!snapshot || snapshot.rows.length === 0) return [];

    const insights: Insight[] = [];
    const premiumInsight = buildPremiumDistributionSignal(snapshot.rows, snapshot);
    if (premiumInsight) insights.push(premiumInsight);
    const availabilityInsight = await buildPlanAvailabilitySignal(snapshot.rows, snapshot, ctx);
    if (availabilityInsight) insights.push(availabilityInsight);

    return insights;
  },
};

function buildPremiumDistributionSignal(
  allRows: MarketplaceRateRow[],
  snapshot: { planYear: number; pulledAt: string; sampledStates: string[]; referenceAge: string }
): Insight | null {
  const rows = plausibleRows(allRows);
  if (rows.length === 0) return null;

  const byState = new Map<string, number[]>();
  for (const r of rows) {
    if (!byState.has(r.state)) byState.set(r.state, []);
    byState.get(r.state)!.push(r.individualRate);
  }
  const boxes = Array.from(byState.entries())
    .filter(([, values]) => values.length >= MIN_ROWS_FOR_BOXPLOT)
    .map(([state, values]) => ({ label: state, ...tukeyBox(values) }))
    .sort((a, b) => a.median - b.median);
  if (boxes.length === 0) return null;

  const cheapest = boxes[0];
  const priciest = boxes[boxes.length - 1];
  const stamp = snapshot.pulledAt.slice(0, 10);
  const confidence = baselineConfidence();

  const summary = boxes
    .map((b) => `${b.label}: median $${b.median.toFixed(0)} (IQR $${b.q1.toFixed(0)}-$${b.q3.toFixed(0)}, n=${b.sampleSize})`)
    .join("; ");

  const insight: Insight = {
    id: `sig-marketplace-${snapshot.planYear}-premium-distribution`,
    headline: `Median individual Marketplace premium (age ${snapshot.referenceAge}, tobacco-neutral) ranges from $${cheapest.median.toFixed(0)} in ${cheapest.label} to $${priciest.median.toFixed(0)} in ${priciest.label} across the ${boxes.length} sampled states, plan year ${snapshot.planYear}.`,
    questionId: "Q067",
    signalType: "baseline",
    period: { start: `${snapshot.planYear}-01-01`, end: stamp },
    population: "marketplace",
    geography: { level: "state", code: boxes.map((b) => b.label).join("/"), label: boxes.map((b) => b.label).join(", ") },
    magnitude: { value: priciest.median, unit: "usd/month", comparedTo: `${cheapest.label} median ($${cheapest.median.toFixed(0)})`, delta: priciest.median - cheapest.median },
    drivers: [
      {
        description: `Real per-plan premiums at CMS's own reference age (${snapshot.referenceAge}), tobacco-neutral rating, by state: ${summary}. ${allRows.length - rows.length} rows were excluded as implausible ($0 or $9999 exactly - a disclosed empirical judgment, not an official CMS-documented convention; see this agent's file header).`,
        supportingEvidenceIds: ["ev-marketplace-rate"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "A real, state-level baseline read on Marketplace premium levels and spread - the starting point for any future pricing/competitive-positioning question (Q067). Median (not mean) is used deliberately given the real right-skewed distribution observed in this data.",
    evidence: [
      {
        id: "ev-marketplace-rate",
        sourceId: SOURCE_ID,
        description: `CMS Marketplace Rate PUF, plan year ${snapshot.planYear}, age ${snapshot.referenceAge}, tobacco-neutral, ${rows.length} plausible real rows across ${snapshot.sampledStates.join(", ")}`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} This is the first real Marketplace Rate PUF snapshot this agent has pulled - no prior pull exists yet to assess persistence or build a baseline.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Bounded to ${snapshot.sampledStates.join(", ")} - the 5 largest Federally-Facilitated Marketplace states by row count in this file. WA, CA, and NY run their own State-Based Exchanges and are not in this federal file at all (see this agent's data adapter for the live-verified detail).`,
      `A single reference age (${snapshot.referenceAge}) and tobacco-neutral rating - real premiums vary by age curve and tobacco status, not captured here.`,
      "List/filed rates, not post-subsidy consumer-paid premiums - most Marketplace enrollees receive a premium tax credit that lowers their actual net cost well below these figures.",
      "9,999 and 0 exact-value rows were excluded as an empirical judgment (statistical outliers), not because CMS's own Rate PUF data dictionary documents them as placeholders - it does not.",
    ],
    nextSignal: "Watch this state ranking and spread across a second real pull for the first genuine premium shift, which is what would move this from baseline to a real trend read.",
    recommendedInternalValidation: "Compare against a real payer's own filed/contracted rates before using this for actual pricing decisions - this is public list-rate data only.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: { type: "boxplot", title: `Individual Marketplace premium distribution by state (age ${snapshot.referenceAge}, tobacco-neutral)`, unit: "usd/month", boxes },
  };

  return validateInsight(insight);
}

async function buildPlanAvailabilitySignal(
  allRows: MarketplaceRateRow[],
  snapshot: { planYear: number; pulledAt: string; sampledStates: string[] },
  ctx: AgentContext
): Promise<Insight | null> {
  const rows = plausibleRows(allRows);
  if (rows.length === 0) return null;

  // State-level distinct-issuer count, not rating-area-level distinct-plan
  // count - redesigned 2026-09-24 after a real data review (caught from
  // Adam's screenshot showing 9 South Carolina rating areas tied at
  // exactly 27 distinct plans): issuers file consistently across every
  // rating area they enter within a state, so a rating-area-level plan
  // count is structurally near-uniform within a state and produces a
  // degenerate, tie-dominated ranking rather than a real competitive-
  // intensity signal. Distinct issuer count aggregated to the STATE level
  // is the metric that actually varies (verified: 7 to 18 real distinct
  // issuers across the 5 sampled states, no ties) - and it's a closer
  // match to Q071's own catalog wording ("number of ISSUERS/plans") than
  // the prior plan-only count was.
  const issuersByState = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!issuersByState.has(r.state)) issuersByState.set(r.state, new Set());
    issuersByState.get(r.state)!.add(r.issuerId);
  }

  const candidates: Candidate[] = Array.from(issuersByState.entries()).map(([state, issuers]) => ({
    id: state,
    label: state,
    summary: `${issuers.size} distinct issuer(s) sampled`,
    primaryMetric: issuers.size,
  }));
  if (candidates.length === 0) return null;

  const { selections, source } = await selectNoteworthy(
    {
      candidates,
      topN: candidates.length, // only 5 real sampled states - show all, not a truncated top-N
      taskDescription: "Marketplace issuer competitive intensity by state this cycle",
      // Fewer issuers is the competitive-intensity signal worth an executive's attention here.
      direction: "lowest",
    },
    ctx
  );
  if (selections.length === 0) return null;

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const selected = selections.map((s) => ({ selection: s, candidate: byId.get(s.candidateId)! })).filter((x) => x.candidate);
  const mostIssuers = candidates.reduce((a, b) => (b.primaryMetric > a.primaryMetric ? b : a));
  const fewestIssuers = candidates.reduce((a, b) => (b.primaryMetric < a.primaryMetric ? b : a));
  const stamp = snapshot.pulledAt.slice(0, 10);
  const confidence = baselineConfidence();

  const summary = selected.map(({ selection, candidate }) => `${candidate.label}: ${candidate.summary} — ${selection.rationale}`).join("; ");

  const insight: Insight = {
    id: `sig-marketplace-${snapshot.planYear}-plan-availability`,
    headline: `Distinct issuer count ranges from ${fewestIssuers.primaryMetric} in ${fewestIssuers.label} to ${mostIssuers.primaryMetric} in ${mostIssuers.label} across the ${candidates.length} real sampled states, plan year ${snapshot.planYear}.`,
    questionId: "Q071",
    signalType: "baseline",
    period: { start: `${snapshot.planYear}-01-01`, end: stamp },
    population: "marketplace",
    geography: { level: "state", code: snapshot.sampledStates.join("/"), label: snapshot.sampledStates.join(", ") },
    magnitude: { value: mostIssuers.primaryMetric, unit: "issuers", comparedTo: `${fewestIssuers.label} (${fewestIssuers.primaryMetric})` },
    drivers: [
      {
        description: `Real distinct-issuer counts per state (counting only plausible-rate rows, see this agent's file header): ${summary}. Candidate selection method: ${source === "llm" ? "model-reasoned salience ranking over all 5 real sampled states" : "deterministic ranking (all real candidates included)"}.`,
        supportingEvidenceIds: ["ev-marketplace-availability"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Distinct issuer count per state is a direct, real competitive-intensity proxy (Q071) - a state with few distinct issuers is a market with limited consumer choice and limited issuer competition, worth flagging for further investigation. State, not rating area, is the geography that actually carries this signal - see limitations.",
    evidence: [
      {
        id: "ev-marketplace-availability",
        sourceId: SOURCE_ID,
        description: `CMS Marketplace Rate PUF, plan year ${snapshot.planYear}, distinct real IssuerId counts by state across ${rows.length} plausible real rows`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} This is the first real Marketplace Rate PUF snapshot with issuer data this agent has pulled - no prior pull exists yet to assess persistence or build a baseline.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Bounded to ${snapshot.sampledStates.join(", ")} - see this agent's data adapter for why WA/CA/NY are structurally absent from this federal file, and why only 5 real states exist to compare (a small real sample, not padded to look larger).`,
      "State, not rating area, is the geography reported here: a real data review found distinct-issuer and distinct-plan counts are near-uniform across rating areas within the same state (issuers file consistently across every rating area they enter) - a rating-area-level version of this same metric produced a degenerate, tie-dominated ranking with no real signal.",
      "Issuer count is a real proxy for consumer choice, not a confirmed antitrust or market-power measure.",
      "Never attributes an issuer count to a named carrier - only an opaque real IssuerId is counted, never surfaced or resolved to a company name (see this agent's data adapter).",
    ],
    nextSignal: "Watch each state's issuer count across a second real pull for the first genuine entry/exit signal, which would be a real market-structure change, not just this baseline snapshot.",
    recommendedInternalValidation: "Not applicable - this is public aggregate plan-filing data, not tied to any specific payer's book of business.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: "Distinct Marketplace issuers sampled per state",
      unit: "issuers",
      bars: selected.map(({ candidate }) => ({ label: candidate.label, value: candidate.primaryMetric })),
    },
  };

  return validateInsight(insight);
}
