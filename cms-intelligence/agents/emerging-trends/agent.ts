/**
 * Emerging Trends & Signal Detection agent - see docs/cms-intelligence/
 * AGENT_ARCHITECTURE.md section 10.
 *
 * Phase 5 addendum (2026-09-23): this agent's whole design point is
 * cross-domain synthesis - finding what two *independent* datasets say
 * together that neither says alone (Q088). Implemented here as a real,
 * concrete cross-reference: state-level hospital facility count
 * (Hospital General Information, via the Market Growth/Provider Network
 * agents' source) against state-level average Medicare physician
 * payment (the Physician & Other Practitioners sample, via the
 * Reimbursement agent's source) - two genuinely independent CMS
 * datasets, joined on the 5 states both happen to cover.
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
import { loadLatestSnapshot as loadHospitalSnapshot, SOURCE_ID as HOSPITAL_SOURCE_ID } from "../../data/adapters/hospitalGeneralInformation";
import { loadLatestSnapshot as loadPhysicianSnapshot, SOURCE_ID as PHYSICIAN_SOURCE_ID } from "../../data/adapters/physicianOtherPractitioners";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import type { AgentContext, DomainAgent } from "../types";

const AGENT_ID = "emerging-trends-signal-detection";

function facilityCountByState(rows: { state: string }[], states: string[]): Map<string, number> {
  const counts = new Map(states.map((s) => [s, 0]));
  for (const row of rows) {
    if (counts.has(row.state)) counts.set(row.state, (counts.get(row.state) ?? 0) + 1);
  }
  return counts;
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

/** Pearson correlation coefficient - simple, standard, no external dependency needed for 5 data points. */
function correlation(xs: number[], ys: number[]): number {
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, denomX = 0, denomY = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    denomX += (xs[i] - meanX) ** 2;
    denomY += (ys[i] - meanY) ** 2;
  }
  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : num / denom;
}

export const emergingTrendsAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: ["Q085", "Q086", "Q087", "Q088", "Q089", "Q090", "Q091", "Q092", "Q093", "Q094", "Q095"],

  async run(_ctx: AgentContext): Promise<Insight[]> {
    const hospitalSnapshot = loadHospitalSnapshot();
    const physicianSnapshot = loadPhysicianSnapshot();
    if (!hospitalSnapshot || !physicianSnapshot) return []; // both real sources required - never synthesize from one

    const states = physicianSnapshot.sampledStates;
    const facilityCounts = facilityCountByState(hospitalSnapshot.rows, states);
    const avgPayments = avgPaymentByState(physicianSnapshot.rows, states);

    const comparableStates = states.filter((s) => (facilityCounts.get(s) ?? 0) > 0 && avgPayments.has(s));
    if (comparableStates.length < 3) return []; // not enough real, comparable states to say anything honest about correlation

    const facilityValues = comparableStates.map((s) => facilityCounts.get(s)!);
    const paymentValues = comparableStates.map((s) => avgPayments.get(s)!);
    const r = correlation(facilityValues, paymentValues);

    const perStateSummary = comparableStates
      .map((s) => `${s}: ${facilityCounts.get(s)} facilities, $${avgPayments.get(s)!.toFixed(0)} avg payment`)
      .join("; ");

    const insight: Insight = {
      id: `sig-emerging-${hospitalSnapshot.pulledAt.slice(0, 10)}-facility-count-vs-payment-correlation`,
      headline: `Across ${comparableStates.length} states with data in both sources, hospital facility count and average Medicare physician payment show a ${Math.abs(r) < 0.3 ? "weak" : Math.abs(r) < 0.6 ? "moderate" : "strong"} ${r >= 0 ? "positive" : "negative"} correlation (r=${r.toFixed(2)}).`,
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
        "The kind of cross-dataset check that's only possible because two independent agents' sources happen to cover the same states - exactly the 'agents working together' pattern this system is meant to demonstrate, not just two agents each reporting in isolation.",
      evidence: [
        {
          id: "ev-hospital-snapshot",
          sourceId: HOSPITAL_SOURCE_ID,
          description: `CMS Hospital General Information, facility counts for ${comparableStates.join(", ")}`,
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
        "Correlation, not causation - facility count and physician payment could both simply track state population/market size rather than influencing each other directly.",
        `Only ${comparableStates.length} states have data in both sources - a 5-point (or fewer) correlation is illustrative, not statistically robust.`,
        "Hospital facility count and individual-physician payment are different entity types (institutional vs. professional) - this is a market-level comparison, not a claim that the same providers appear in both datasets.",
      ],
      nextSignal: "Watch whether this correlation direction holds once more states or more periods are added to either source.",
      recommendedInternalValidation: "Not applicable - both sides are public aggregate data.",
      sourceIds: [HOSPITAL_SOURCE_ID, PHYSICIAN_SOURCE_ID],
      generatingAgent: AGENT_ID,
    };

    return [validateInsight(insight)];
  },
};
