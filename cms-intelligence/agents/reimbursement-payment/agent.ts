/**
 * Reimbursement & Payment Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 4.
 *
 * Phase 5 addendum (2026-09-23) wires this agent to a real, live-pulled
 * dataset: CMS Medicare Physician & Other Practitioners by Provider and
 * Service (see cms-intelligence/data/adapters/
 * physicianOtherPractitioners.ts - a 5-state bounded sample, not the
 * full national file, documented in that adapter's header). This is
 * "external reimbursement benchmarks" per this agent's own scope in
 * AGENT_ARCHITECTURE.md - the real CMS-published payment side of a
 * future internal-vs-external divergence comparison (Q031), not yet
 * a rule-change tracker (Q026-Q030 stay unimplemented pending a real
 * Federal Register/fee-schedule-rule source).
 *
 * Computes, per provider type: average submitted charge vs. average
 * Medicare payment - a genuine "claims vs. payments by provider type"
 * read, directly real and non-fabricated. Dynamic confidence/signalType
 * via snapshotHistory.ts, same pattern as the other real agents - only
 * one real snapshot exists so far, so this is honestly a baseline.
 */
import { loadLatestSnapshot, SOURCE_ID, type PhysicianServiceRow } from "../../data/adapters/physicianOtherPractitioners";
import { assessSnapshotHistory } from "../../data/sources/snapshotHistory";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { classifyConfidence } from "../../intelligence/trends/trend";
import type { AgentContext, DomainAgent } from "../types";

const AGENT_ID = "reimbursement-payment-intelligence";
const TOP_N_PROVIDER_TYPES = 5;
const MIN_ROWS_PER_TYPE = 10; // avoid a noisy average from a handful of rows

export interface ProviderTypeStats {
  providerType: string;
  rowCount: number;
  avgSubmittedCharge: number;
  avgMedicarePayment: number;
  paymentToChargeRatio: number;
}

/** Exported for reuse by the Data Explorer analytics section - see cms-intelligence/analytics/overview.ts. */
export function computeStatsByProviderType(rows: PhysicianServiceRow[]): ProviderTypeStats[] {
  const groups = new Map<string, { charges: number[]; payments: number[] }>();
  for (const row of rows) {
    const type = row.Rndrng_Prvdr_Type;
    const charge = Number(row.Avg_Sbmtd_Chrg);
    const payment = Number(row.Avg_Mdcr_Pymt_Amt);
    if (!type || Number.isNaN(charge) || Number.isNaN(payment)) continue;
    if (!groups.has(type)) groups.set(type, { charges: [], payments: [] });
    groups.get(type)!.charges.push(charge);
    groups.get(type)!.payments.push(payment);
  }

  const stats: ProviderTypeStats[] = [];
  for (const [providerType, { charges, payments }] of groups) {
    if (charges.length < MIN_ROWS_PER_TYPE) continue;
    const avgSubmittedCharge = charges.reduce((s, v) => s + v, 0) / charges.length;
    const avgMedicarePayment = payments.reduce((s, v) => s + v, 0) / payments.length;
    stats.push({
      providerType,
      rowCount: charges.length,
      avgSubmittedCharge,
      avgMedicarePayment,
      paymentToChargeRatio: avgMedicarePayment / avgSubmittedCharge,
    });
  }
  return stats.sort((a, b) => b.rowCount - a.rowCount);
}

export const reimbursementPaymentAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: ["Q026", "Q027", "Q028", "Q029", "Q030", "Q031", "Q032", "Q033", "Q034", "Q035"],

  async run(_ctx: AgentContext): Promise<Insight[]> {
    const snapshot = loadLatestSnapshot();
    if (!snapshot || snapshot.rows.length === 0) return [];

    const allStats = computeStatsByProviderType(snapshot.rows);
    if (allStats.length === 0) return [];
    const topStats = allStats.slice(0, TOP_N_PROVIDER_TYPES);

    const history = assessSnapshotHistory([snapshot.pulledAt.slice(0, 10)]);
    const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: false, hasExternalCorroboration: false });

    const summary = topStats
      .map((s) => `${s.providerType}: submitted $${s.avgSubmittedCharge.toFixed(0)} → paid $${s.avgMedicarePayment.toFixed(0)} (${(s.paymentToChargeRatio * 100).toFixed(0)}% of charge)`)
      .join("; ");

    const insight: Insight = {
      id: `sig-reimbursement-${history.latestDate}-payment-vs-charge-by-provider-type`,
      headline: `Across the top ${topStats.length} provider types in this sample, Medicare pays ${(topStats.reduce((s, t) => s + t.paymentToChargeRatio, 0) / topStats.length * 100).toFixed(0)}% of submitted charges on average — ${topStats[0].providerType} shows the largest volume.`,
      questionId: "Q031",
      signalType: "baseline",
      period: { start: history.latestDate, end: history.latestDate },
      population: "medicare-ffs",
      geography: { level: "state", code: snapshot.sampledStates.join("/"), label: `${snapshot.sampledStates.join(", ")} (5-state sample, not national)` },
      magnitude: {
        value: topStats[0].paymentToChargeRatio * 100,
        unit: "percent",
        comparedTo: `${topStats[0].providerType} average submitted charge`,
      },
      drivers: [
        {
          description: `Per-provider-type averages from ${snapshot.rowCount} real claims lines: ${summary}.`,
          supportingEvidenceIds: ["ev-phy-snapshot"],
          relationship: "correlation",
        },
      ],
      businessRelevance:
        "Establishes a real, CMS-published payment benchmark by provider type - the public-data half of any future internal-vs-external reimbursement divergence comparison (see DATA_GAP_REGISTER.md #1 for why the internal half isn't available here).",
      evidence: [
        {
          id: "ev-phy-snapshot",
          sourceId: SOURCE_ID,
          description: `CMS Medicare Physician & Other Practitioners, 5-state sample (${snapshot.sampledStates.join(", ")}), ${snapshot.rowCount} rows`,
          datasetVintage: history.latestDate,
        },
      ],
      contradictoryEvidence: [],
      confidence: confidence.level,
      confidenceRationale: `${confidence.rationale} Only one real snapshot exists, and it covers 5 sampled states, not the full national dataset.`,
      freshness: { dataAsOf: history.latestDate, generatedAt: new Date().toISOString(), isStale: false },
      limitations: [
        "Sample covers 5 states (WA, CA, TX, NY, FL) only, up to 1,000 rows each - not the full national dataset, which runs to tens of millions of rows for this file.",
        "Payment-to-charge ratio reflects Medicare's fee-schedule-driven allowed amount, not a negotiated commercial rate - submitted charge is a provider's list price, not a market price.",
        "Provider-type groups with fewer than 10 sampled rows are excluded to avoid a noisy average from a small sample.",
      ],
      nextSignal: "Watch for this ratio's stability across provider types once a second real pull exists, and consider expanding the state sample if a broader geographic read is needed.",
      recommendedInternalValidation: "Compare against a real payer's own contracted/allowed-amount data if this is ever used for anything beyond portfolio demonstration - this is a public FFS benchmark only.",
      sourceIds: [SOURCE_ID],
      generatingAgent: AGENT_ID,
      chart: {
        type: "bar",
        title: "Medicare payment as % of submitted charge, by provider type",
        unit: "% of charge",
        bars: topStats.map((s) => ({ label: s.providerType, value: Math.round(s.paymentToChargeRatio * 100) })),
      },
    };

    return [validateInsight(insight)];
  },
};
