/**
 * Emerging Trends & Signal Detection agent - see docs/cms-intelligence/
 * AGENT_ARCHITECTURE.md section 10.
 *
 * Phase 5 addendum (2026-09-23): this agent's whole design point is
 * cross-domain synthesis - finding what two *independent* datasets say
 * together that neither says alone (Q088). Implemented here as a real,
 * concrete cross-reference: state-level hospital OWNERSHIP CONCENTRATION
 * (Hospital General Information's CR4, via Provider & Network's own
 * `cr4For` - reused, not reimplemented) against state-level average
 * Medicare physician payment per service (the full-population Physician
 * & Other Practitioners summary tables, via the Reimbursement agent's
 * source) - two genuinely independent CMS datasets, joined on every state.
 * Until 2026-09-25 the physician side was a 5-state sample, so this
 * correlation rested on 5 points; it now uses all 50 states and DC, and
 * standardized payment, which removes the geographic price adjustments
 * that would otherwise make cost of living a confounder.
 *
 * REDESIGNED 2026-09-24 (real feedback, not a bug): this originally
 * paired raw hospital FACILITY COUNT against physician payment. Adam
 * correctly flagged that pairing as mechanically obvious - more
 * facilities in a state naturally implies more physicians are needed to
 * staff them, so a positive correlation there confirms nothing an
 * executive didn't already know. Hospital ownership CONCENTRATION has no
 * such definitional link to physician payment levels - a real, less
 * obvious market-power question (does a more consolidated hospital
 * market coincide with higher or lower physician reimbursement?) that's
 * actually worth an executive's attention regardless of which direction
 * the real, honestly-disclosed-as-weak result points.
 *
 * Pragmatic implementation note: this reads both adapters directly
 * rather than consuming the other agents' structured Insight objects
 * through a shared context (AgentContext has no `priorInsights` field
 * yet). That's a real architectural simplification, not a design
 * ideal - a fuller version would thread accumulated Insight objects
 * through cms-intelligence/agents/orchestrator/fullSweep.ts so this
 * agent genuinely consumes other agents' output rather than
 * re-reading source data. Documented honestly rather than presented as
 * the finished design; a reasonable next refinement.
 *
 * Correlation only, never causal - see the `relationship` field below.
 * Two real, independently-sourced datasets agreeing (or not) is exactly
 * what "corroboration" means in TREND_FRAMEWORK.md, and this is
 * deliberately labeled a cross-sectional check, not a trend.
 */
import { cr4For } from "../provider-network/agent";
import { loadLatestSnapshot as loadHospitalSnapshot, SOURCE_ID as HOSPITAL_SOURCE_ID } from "../../data/adapters/hospitalGeneralInformation";
import { loadAllYears as loadPhysicianYears, SOURCE_ID as PHYSICIAN_SOURCE_ID } from "../../data/adapters/physicianByProviderSummary";
import { byState, US_STATES } from "../../intelligence/metrics/physicianTrends";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { pearsonCorrelation } from "../../intelligence/metrics/metrics";
import type { AgentContext, DomainAgent } from "../types";

const AGENT_ID = "emerging-trends-signal-detection";

function ownershipConcentrationByState(rows: { state: string; hospital_ownership?: string }[], states: string[]): Map<string, number> {
  const concentrations = new Map<string, number>();
  for (const state of states) {
    const stateRows = rows.filter((r) => r.state === state);
    if (stateRows.length > 0) concentrations.set(state, cr4For(stateRows));
  }
  return concentrations;
}

/** Smallest |r| that is significant at p < 0.05 (two-tailed) for n points: t = 1.96 approximation, r = t / sqrt(n - 2 + t^2). */
function criticalR(n: number): number {
  return 1.96 / Math.sqrt(n - 2 + 1.96 ** 2);
}

export const emergingTrendsAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: ["Q085", "Q086", "Q087", "Q088", "Q089", "Q090", "Q091", "Q092", "Q093", "Q094", "Q095"],

  async run(_ctx: AgentContext): Promise<Insight[]> {
    const hospitalSnapshot = loadHospitalSnapshot();
    const physicianYears = loadPhysicianYears();
    const physicianYear = physicianYears[physicianYears.length - 1];
    if (!hospitalSnapshot || !physicianYear) return []; // both real sources required - never synthesize from one

    const states = [...US_STATES];
    const concentrations = ownershipConcentrationByState(hospitalSnapshot.rows, states);
    const avgPayments = new Map(
      [...byState(physicianYear)].filter(([, t]) => t.services > 0).map(([state, t]) => [state, t.standardizedPayment / t.services])
    );
    const physicianAsOf = `${physicianYear.dataYear}-12-31`;

    const comparableStates = states.filter((s) => concentrations.has(s) && avgPayments.has(s));
    if (comparableStates.length < 3) return []; // not enough real, comparable states to say anything honest about correlation

    const concentrationValues = comparableStates.map((s) => concentrations.get(s)!);
    const paymentValues = comparableStates.map((s) => avgPayments.get(s)!);
    const r = pearsonCorrelation(concentrationValues, paymentValues);

    const perStateSummary = comparableStates
      .map((s) => `${s}: ${concentrations.get(s)!.toFixed(1)}% CR4, ${avgPayments.get(s)!.toFixed(2)} per service`)
      .join("; ");

    const insight: Insight = {
      id: `sig-emerging-${hospitalSnapshot.pulledAt.slice(0, 10)}-ownership-concentration-vs-payment-correlation`,
      headline: `Across ${comparableStates.length} states with data in both sources, hospital ownership concentration (CR4) and standardized Medicare physician payment per service show a ${Math.abs(r) < 0.3 ? "weak" : Math.abs(r) < 0.6 ? "moderate" : "strong"} ${r >= 0 ? "positive" : "negative"} correlation (r=${r.toFixed(2)}).`,
      questionId: "Q088",
      signalType: "baseline",
      period: { start: hospitalSnapshot.pulledAt.slice(0, 10), end: hospitalSnapshot.pulledAt.slice(0, 10) },
      population: "medicare-ffs",
      geography: { level: "state", code: "US-STATES", label: `${comparableStates.length} states and DC with data in both sources` },
      magnitude: { value: r, unit: "pearson-r", comparedTo: "0 (no linear relationship)" },
      drivers: [
        {
          description: `Per-state values (physician side: data year ${physicianYear.dataYear}, every provider): ${perStateSummary}. With ${comparableStates.length} states, a correlation beyond about ${criticalR(comparableStates.length).toFixed(2)} in either direction is unlikely by chance (p < 0.05).`,
          supportingEvidenceIds: ["ev-hospital-snapshot", "ev-physician-snapshot"],
          relationship: "correlation",
        },
      ],
      businessRelevance:
        "Unlike a facility-count comparison (mechanically expected to track physician staffing), hospital ownership concentration has no definitional link to physician payment levels - this is a real market-power question (does a more consolidated hospital market coincide with higher or lower physician reimbursement?) worth an executive's attention regardless of which direction the result points. The kind of cross-dataset check that's only possible because two independent agents' sources happen to cover the same states - exactly the 'agents working together' pattern this system is meant to demonstrate, not just two agents each reporting in isolation.",
      evidence: [
        {
          id: "ev-hospital-snapshot",
          sourceId: HOSPITAL_SOURCE_ID,
          description: `CMS Hospital General Information, real ownership-concentration (CR4) for ${comparableStates.length} states and DC`,
          datasetVintage: hospitalSnapshot.pulledAt.slice(0, 10),
        },
        {
          id: "ev-physician-snapshot",
          sourceId: PHYSICIAN_SOURCE_ID,
          description: `CMS Medicare Physician & Other Practitioners - by Provider, standardized payment per service by state, every provider in data year ${physicianYear.dataYear}`,
          datasetVintage: physicianAsOf,
        },
      ],
      contradictoryEvidence: [],
      confidence: "low",
      confidenceRationale: `${comparableStates.length} states are comparable across both sources, but this is cross-sectional (one point in time per state), not a trend across periods, and the two sides are from different years.`,
      freshness: {
        dataAsOf: physicianAsOf,
        generatedAt: new Date().toISOString(),
        isStale: false,
      },
      limitations: [
        "Correlation, not causation - either variable could track a real underlying driver (e.g. state cost-of-living or regulatory environment) rather than one influencing the other directly.",
        `The hospital side is the current CMS directory and the physician side is CMS's ${physicianYear.dataYear} data year - the latest each publishes, not the same year.`,
        "States are where the billing provider is located, not where the patient lives.",
        "Hospital ownership concentration (institutional) and individual-physician payment (professional) are different entity types - this is a market-level comparison, not a claim that the same providers appear in both datasets.",
      ],
      nextSignal: "Watch whether this correlation direction holds once more states or more periods are added to either source.",
      recommendedInternalValidation: "Not applicable - both sides are public aggregate data.",
      sourceIds: [HOSPITAL_SOURCE_ID, PHYSICIAN_SOURCE_ID],
      generatingAgent: AGENT_ID,
      chart: {
        type: "scatter",
        title: "Hospital ownership concentration vs. standardized physician payment per service, by state",
        xLabel: "Hospital ownership concentration (CR4)",
        yLabel: "Standardized Medicare payment per service",
        xUnit: "%",
        yUnit: "USD",
        points: comparableStates.map((s) => ({ label: s, x: Math.round(concentrations.get(s)! * 10) / 10, y: Math.round(avgPayments.get(s)! * 100) / 100 })),
      },
    };

    return [validateInsight(insight)];
  },
};
