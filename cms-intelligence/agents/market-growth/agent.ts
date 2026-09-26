/**
 * Market Growth & Geographic Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 2 for full scope.
 *
 * Wired to two real, live-pulled datasets:
 * - cms-intelligence/data/adapters/providerOfServices.ts (added
 *   2026-09-25, see capacityInsights.ts) - certified hospital and nursing
 *   home beds by state and active facilities by type, 2011 onward. This
 *   replaced a hospital count by state from a single Hospital General
 *   Information snapshot.
 * - cms-intelligence/data/adapters/homeHealthCareAgencies.ts (added
 *   2026-09-23, second Phase 5 addendum) - a state-level home-health
 *   capacity signal (Q006), after Adam asked for a "growing opportunity"
 *   read on care settings/provider networks. That needs a demand-side
 *   proxy this system didn't have wired - rather than reaching for
 *   external Census/enrollment data, this uses a real field already in
 *   the pulled data: total home-health episodes per agency
 *   (`no_of_episodes_to_calc...`), summed by state, is a genuine
 *   utilization/demand proxy. Episodes-per-agency (demand / supply) is
 *   the actual signal, shown alongside quality and reimbursement
 *   efficiency so the "opportunity" claim is auditable component by
 *   component, not a black-box score. This is explicitly a supply/
 *   demand/quality/efficiency baseline, not a demand-*growth* claim -
 *   no population or eligible-beneficiary denominator exists here, so
 *   it cannot say a market is under-served relative to true demand,
 *   only relative to its own current episode volume.
 *
 * Confidence and signalType are computed dynamically from actual
 * snapshot history (cms-intelligence/data/sources/snapshotHistory.ts),
 * never hardcoded.
 *
 * Which states each chart shows goes through the salience layer
 * (intelligence/salience/selectNoteworthy.ts, retrofitted 2026-09-24):
 * deterministic top-N when no model is configured (identical to this
 * agent's original output), model-reasoned when one is. Headline claims
 * like "most concentrated in" or "highest episodes per agency" are
 * computed from the full real ranking, never from the selection, so they
 * stay true regardless of which states the model picked to chart.
 */
import {
  loadLatestSnapshot as loadHomeHealthSnapshot,
  parseNumericCell,
  SOURCE_ID as HOME_HEALTH_SOURCE_ID,
  type HomeHealthAgencyRow,
} from "../../data/adapters/homeHealthCareAgencies";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import type { AgentContext, DomainAgent } from "../types";
import { buildCapacityInsights } from "./capacityInsights";

const AGENT_ID = "market-growth-geographic-intelligence";
const TOP_N_STATES = 5;
const MIN_AGENCIES_PER_STATE = 20; // avoid a noisy read from a small-sample state
const SERVICE_FIELDS = [
  "offers_nursing_care_services",
  "offers_physical_therapy_services",
  "offers_occupational_therapy_services",
  "offers_speech_pathology_services",
  "offers_medical_social_services",
  "offers_home_health_aide_services",
] as const;

interface StateHomeHealthStats {
  state: string;
  agencyCount: number;
  totalEpisodes: number;
  episodesPerAgency: number;
  avgStarRating: number | null;
  avgSpendingRatio: number | null;
  fullServiceAgencyPct: number;
}

function computeStateHomeHealthStats(rows: HomeHealthAgencyRow[]): StateHomeHealthStats[] {
  const byState = new Map<string, HomeHealthAgencyRow[]>();
  for (const row of rows) {
    if (!row.state) continue;
    if (!byState.has(row.state)) byState.set(row.state, []);
    byState.get(row.state)!.push(row);
  }

  const stats: StateHomeHealthStats[] = [];
  for (const [state, stateRows] of byState) {
    if (stateRows.length < MIN_AGENCIES_PER_STATE) continue;

    let totalEpisodes = 0;
    const starRatings: number[] = [];
    const spendingRatios: number[] = [];
    let fullServiceCount = 0;

    for (const row of stateRows) {
      const episodes = parseNumericCell(row.no_of_episodes_to_calc_how_much_medicare_spends_per_episode_4f4e);
      if (!Number.isNaN(episodes)) totalEpisodes += episodes;

      const star = parseNumericCell(row.quality_of_patient_care_star_rating);
      if (!Number.isNaN(star)) starRatings.push(star);

      const ratio = parseNumericCell(row.how_much_medicare_spends_on_an_episode_of_care_at_this_agen_56e6);
      if (!Number.isNaN(ratio)) spendingRatios.push(ratio);

      if (SERVICE_FIELDS.every((f) => row[f] === "Yes")) fullServiceCount++;
    }

    stats.push({
      state,
      agencyCount: stateRows.length,
      totalEpisodes,
      episodesPerAgency: totalEpisodes / stateRows.length,
      avgStarRating: starRatings.length > 0 ? starRatings.reduce((s, v) => s + v, 0) / starRatings.length : null,
      avgSpendingRatio: spendingRatios.length > 0 ? spendingRatios.reduce((s, v) => s + v, 0) / spendingRatios.length : null,
      fullServiceAgencyPct: (fullServiceCount / stateRows.length) * 100,
    });
  }
  return stats;
}

export const marketGrowthAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: ["Q001", "Q004", "Q006"],

  async run(ctx: AgentContext): Promise<Insight[]> {
    const insights = await buildCapacityInsights(ctx);
    const homeHealthInsight = await buildHomeHealthCapacitySignal(ctx);
    if (homeHealthInsight) insights.push(homeHealthInsight);
    return insights;
  },
};

async function buildHomeHealthCapacitySignal(ctx: AgentContext): Promise<Insight | null> {
  const snapshot = loadHomeHealthSnapshot();
  if (!snapshot || snapshot.rows.length === 0) return null;

  const stateStats = computeStateHomeHealthStats(snapshot.rows);
  if (stateStats.length === 0) return null;

  const ratingsWithData = stateStats.filter((s) => s.avgStarRating !== null);
  const medianStarRating = ratingsWithData.length
    ? [...ratingsWithData].sort((a, b) => (a.avgStarRating! - b.avgStarRating!))[Math.floor(ratingsWithData.length / 2)].avgStarRating!
    : 0;

  // "Opportunity" candidates: above-median quality AND spending ratio not
  // meaningfully above the CMS benchmark of 1.0 (<=1.1) - transparent,
  // fixed thresholds, not a tuned/black-box score.
  const eligible = stateStats.filter(
    (s) => s.avgStarRating !== null && s.avgStarRating >= medianStarRating && s.avgSpendingRatio !== null && s.avgSpendingRatio <= 1.1
  );
  if (eligible.length === 0) return null;

  const describe = (s: StateHomeHealthStats) =>
    `${s.episodesPerAgency.toFixed(0)} episodes/agency across ${s.agencyCount} agencies, ${s.avgStarRating!.toFixed(1)}★ quality, ${s.avgSpendingRatio!.toFixed(2)} spending ratio, ${s.fullServiceAgencyPct.toFixed(0)}% full-service-line agencies`;
  const candidates: Candidate[] = eligible.map((s) => ({ id: s.state, label: s.state, summary: describe(s), primaryMetric: s.episodesPerAgency }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_STATES, taskDescription: "home health capacity-pressure signals by state this cycle" },
    ctx
  );
  const statsByState = new Map(eligible.map((s) => [s.state, s]));
  const selected = selections.filter((s) => statsByState.has(s.candidateId)).map((s) => ({ rationale: s.rationale, stats: statsByState.get(s.candidateId)! }));
  if (selected.length === 0) return null;
  const ranked = selected.map((x) => x.stats);

  const stamp = snapshot.pulledAt.slice(0, 10);
  const summary = selected
    .map(({ stats, rationale }) => `${stats.state}: ${describe(stats)}${source === "llm" ? ` — ${rationale}` : ""}`)
    .join("; ");

  // The headline's "highest" claim must hold regardless of how the selection was ordered.
  const top = eligible.reduce((a, b) => (b.episodesPerAgency > a.episodesPerAgency ? b : a));
  const insight: Insight = {
    id: `sig-market-growth-${stamp}-home-health-capacity-signal`,
    headline: `${top.state} shows the highest home-health episode volume per agency (${top.episodesPerAgency.toFixed(0)}) among states with above-median quality and favorable spending efficiency — a capacity-pressure signal, not a confirmed growth trend.`,
    questionId: "Q006",
    signalType: "baseline",
    period: { start: stamp, end: stamp },
    population: "medicare-ffs",
    geography: { level: "state", code: ranked.map((s) => s.state).join("/"), label: ranked.map((s) => s.state).join(", ") },
    magnitude: { value: top.episodesPerAgency, unit: "episodes-per-agency", comparedTo: `${top.state} agency count (${top.agencyCount})` },
    drivers: [
      {
        description:
          source === "llm"
            ? `Selected by model-reasoned salience ranking over all ${eligible.length} states with above-median quality (≥${medianStarRating.toFixed(1)}★) and spending ratio ≤1.10: ${summary}.`
            : `Ranked by real episodes-per-agency among states with above-median quality (≥${medianStarRating.toFixed(1)}★) and spending ratio ≤1.10: ${summary}.`,
        supportingEvidenceIds: ["ev-hh-capacity"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Episodes-per-agency is a real utilization/demand proxy (no external population data was available or used) — high volume per agency, combined with above-median quality and spending near the CMS benchmark, is a defensible starting point for where added home-health capacity or provider-network investment might be worth investigating further, not a confirmed growth opportunity.",
    evidence: [
      {
        id: "ev-hh-capacity",
        sourceId: HOME_HEALTH_SOURCE_ID,
        description: `CMS Home Health Care Agencies, all ${snapshot.rowCount} agencies nationally, aggregated by state (states with fewer than ${MIN_AGENCIES_PER_STATE} agencies excluded)`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: "low",
    confidenceRationale:
      "Single snapshot (cross-sectional, not a trend across periods) and no independent corroborating source for this specific combined read - meets none of the three confidence criteria (history, persistence, corroboration) yet.",
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "Episodes-per-agency is a demand proxy derived from this dataset itself (total episodes billed), not an independent population or Medicare-eligible-beneficiary denominator — it says a state's existing agencies are handling high volume, not that the state is under-served relative to true demand.",
      "Not a growth trend — this is a single-snapshot ranking; it becomes a trend only once it persists across several pulls.",
      `States with fewer than ${MIN_AGENCIES_PER_STATE} agencies are excluded to avoid a noisy per-agency average from a handful of agencies.`,
      "\"Full-service-line\" means an agency reports offering all 6 tracked service types (nursing, PT, OT, speech, medical social, home health aide) - it does not measure service quality or capacity within each service line.",
    ],
    nextSignal: "Watch whether these states' episodes-per-agency and spending ratios hold or shift once a second real snapshot exists, and consider adding a real Medicare-eligible-population-by-state source to convert this into a true demand-adjusted read.",
    recommendedInternalValidation: "Compare against a real payer's own home-health network adequacy and utilization data before using this for actual investment decisions — this is a public aggregate signal only.",
    sourceIds: [HOME_HEALTH_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: "Home-health episodes per agency, top candidate states",
      unit: "episodes/agency",
      bars: ranked.map((s) => ({ label: s.state, value: Math.round(s.episodesPerAgency) })),
    },
  };

  return validateInsight(insight);
}
