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
 * Medicare physician payment (the Physician & Other Practitioners
 * sample, via the Reimbursement agent's source) - two genuinely
 * independent CMS datasets, joined on the 5 states both happen to cover.
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
import { loadLatestSnapshot as loadPhysicianSnapshot, SOURCE_ID as PHYSICIAN_SOURCE_ID } from "../../data/adapters/physicianOtherPractitioners";
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

function avgPaymentByState(rows: { Rndrng_Prvdr_State_Abrvtn: string; Avg_Mdcr_Pymt_Amt: string }[], states: string[]): Map<string, number> {
  const sums = new Map(states.map((s) => [s, { total: 0, count: 0 }]));
  for (const row of rows) {
    const entry = sums.get(row.Rndrng_Prvdr_State_Abrvtn);
    const payment = Number(row.Avg_Mdcr_Pymt_Amt);
    if (entry && !Number.isNaN(payment)) {
      entry.total += payment;
      entry.count += 1;
    }
  }
  const averages = new Map<string, number>();
  for (const [state, { total, count }] of sums) {
    if (count > 0) averages.set(state, total / count);
  }
  return averages;
}

export const emergingTrendsAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: ["Q085", "Q086", "Q087", "Q088", "Q089", "Q090", "Q091", "Q092", "Q093", "Q094", "Q095"],

  async run(_ctx: AgentContext): Promise<Insight[]> {
    const hospitalSnapshot = loadHospitalSnapshot();
    const physicianSnapshot = loadPhysicianSnapshot();
    if (!hospitalSnapshot || !physicianSnapshot) return []; // both real sources required - never synthesize from one

    const states = physicianSnapshot.sampledStates;
    const concentrations = ownershipConcentrationByState(hospitalSnapshot.rows, states);
    const avgPayments = avgPaymentByState(physicianSnapshot.rows, states);

    const comparableStates = states.filter((s) => concentrations.has(s) && avgPayments.has(s));
    if (comparableStates.length < 3) return []; // not enough real, comparable states to say anything honest about correlation

    const concentrationValues = comparableStates.map((s) => concentrations.get(s)!);
    const paymentValues = comparableStates.map((s) => avgPayments.get(s)!);
    const r = pearsonCorrelation(concentrationValues, paymentValues);

    const perStateSummary = comparableStates
      .map((s) => `${s}: ${concentrations.get(s)!.toFixed(1)}% CR4, $${avgPayments.get(s)!.toFixed(0)} avg payment`)
      .join("; ");

    const insight: Insight = {
      id: `sig-emerging-${hospitalSnapshot.pulledAt.slice(0, 10)}-ownership-concentration-vs-payment-correlation`,
      headline: `Across ${comparableStates.length} states with data in both sources, hospital ownership concentration (CR4) and average Medicare physician payment show a ${Math.abs(r) < 0.3 ? "weak" : Math.abs(r) < 0.6 ? "moderate" : "strong"} ${r >= 0 ? "positive" : "negative"} correlation (r=${r.toFixed(2)}).`,
      questionId: "Q088",
      signalType: "baseline",
      period: { start: hospitalSnapshot.pulledAt.slice(0, 10), end: hospitalSnapshot.pulledAt.slice(0, 10) },
      population: "medicare-ffs",
      geography: { level: "state", code: comparableStates.join("/"), label: `${comparableStates.join(", ")} (states covered by both independent samples)` },
      magnitude: { value: r, unit: "pearson-r", comparedTo: "0 (no linear relationship)" },
      drivers: [
        {
          description: `Per-state values: ${perStateSummary}.`,
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
          description: `CMS Hospital General Information, real ownership-concentration (CR4) for ${comparableStates.join(", ")}`,
          datasetVintage: hospitalSnapshot.pulledAt.slice(0, 10),
        },
        {
          id: "ev-physician-snapshot",
          sourceId: PHYSICIAN_SOURCE_ID,
          description: `CMS Medicare Physician & Other Practitioners, average payment for ${comparableStates.join(", ")}`,
          datasetVintage: physicianSnapshot.pulledAt.slice(0, 10),
        },
      ],
      contradictoryEvidence: [],
      confidence: "low",
      confidenceRationale: `Only ${comparableStates.length} states are comparable across both real samples - a correlation computed from this few points is directional at best, not a confident finding. Also cross-sectional (one point in time per state), not a trend across periods.`,
      freshness: {
        dataAsOf: hospitalSnapshot.pulledAt.slice(0, 10) < physicianSnapshot.pulledAt.slice(0, 10) ? hospitalSnapshot.pulledAt.slice(0, 10) : physicianSnapshot.pulledAt.slice(0, 10),
        generatedAt: new Date().toISOString(),
        isStale: false,
      },
      limitations: [
        "Correlation, not causation - either variable could track a real underlying driver (e.g. state cost-of-living or regulatory environment) rather than one influencing the other directly.",
        `Only ${comparableStates.length} states have data in both sources - a 5-point (or fewer) correlation is illustrative, not statistically robust; a weak result here is an honest finding, not a failed one.`,
        "Hospital ownership concentration (institutional) and individual-physician payment (professional) are different entity types - this is a market-level comparison, not a claim that the same providers appear in both datasets.",
      ],
      nextSignal: "Watch whether this correlation direction holds once more states or more periods are added to either source.",
      recommendedInternalValidation: "Not applicable - both sides are public aggregate data.",
      sourceIds: [HOSPITAL_SOURCE_ID, PHYSICIAN_SOURCE_ID],
      generatingAgent: AGENT_ID,
    };

    return [validateInsight(insight)];
  },
};
