/**
 * Reimbursement & Payment Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 4.
 *
 * Reads the full-population CMS Medicare Physician & Other Practitioners
 * summary tables (data/adapters/physicianByProviderSummary.ts): every
 * Part B provider in the latest data year, not a sample. Switched
 * 2026-09-25 from a 5-state sample that turned out to be the first 1,000
 * rows per state in API order (560 providers, all with low-numbered NPIs).
 * This is "external reimbursement benchmarks" per this agent's scope in
 * AGENT_ARCHITECTURE.md - the CMS-published payment side of a future
 * internal-vs-external divergence comparison (Q031).
 *
 * Computes, per provider type: total Medicare payment as a share of total
 * submitted charges (dollar-weighted, so large practices count in
 * proportion to what they bill). Which provider types to show goes through
 * the salience layer; the headline's "largest payment" claim is computed
 * from the full ranking, so it stays true whichever types are shown.
 */
import { loadAllYears, SOURCE_ID, type PhysicianYearData } from "../../data/adapters/physicianByProviderSummary";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { nationalByProviderType } from "../../intelligence/metrics/physicianTrends";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence } from "../../intelligence/trends/trend";
import type { AgentContext, DomainAgent } from "../types";

const AGENT_ID = "reimbursement-payment-intelligence";
const TOP_N_PROVIDER_TYPES = 5;
const MIN_PROVIDERS_PER_TYPE = 100; // a ratio over fewer providers swings on a few large billers

export interface ProviderTypeStats {
  providerType: string;
  providers: number;
  submittedCharges: number;
  medicarePayment: number;
  paymentToChargeRatio: number;
}

/** Exported for reuse by the Data Explorer analytics section - see cms-intelligence/analytics/overview.ts. Sorted by Medicare payment, largest first. */
export function computeStatsByProviderType(year: PhysicianYearData): ProviderTypeStats[] {
  return [...nationalByProviderType(year)]
    .filter(([, t]) => t.providers >= MIN_PROVIDERS_PER_TYPE && t.submittedCharges > 0)
    .map(([providerType, t]) => ({
      providerType,
      providers: t.providers,
      submittedCharges: t.submittedCharges,
      medicarePayment: t.medicarePayment,
      paymentToChargeRatio: t.medicarePayment / t.submittedCharges,
    }))
    .sort((a, b) => b.medicarePayment - a.medicarePayment);
}

export const reimbursementPaymentAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: ["Q026", "Q027", "Q028", "Q029", "Q030", "Q031", "Q032", "Q033", "Q034", "Q035"],

  async run(ctx: AgentContext): Promise<Insight[]> {
    const years = loadAllYears();
    const year = years[years.length - 1];
    if (!year) return [];

    const allStats = computeStatsByProviderType(year);
    if (allStats.length === 0) return [];

    const describe = (s: ProviderTypeStats) =>
      `$${(s.submittedCharges / 1e6).toFixed(0)}M submitted → $${(s.medicarePayment / 1e6).toFixed(0)}M paid (${(s.paymentToChargeRatio * 100).toFixed(0)}% of charges)`;
    const candidates: Candidate[] = allStats.map((s) => ({
      id: s.providerType,
      label: s.providerType,
      summary: `${describe(s)}, ${s.providers.toLocaleString()} providers`,
      primaryMetric: s.medicarePayment,
    }));
    const { selections, source } = await selectNoteworthy(
      { candidates, topN: TOP_N_PROVIDER_TYPES, taskDescription: `Medicare payment-to-charge ratio by provider type, ${year.dataYear}` },
      ctx
    );
    const statsByType = new Map(allStats.map((s) => [s.providerType, s]));
    const selected = selections
      .map((sel) => ({ rationale: sel.rationale, stats: statsByType.get(sel.candidateId)! }))
      .filter((x) => x.stats);
    if (selected.length === 0) return [];
    const topStats = selected.map((x) => x.stats);
    // allStats is sorted by payment desc, so [0] is the true largest regardless of what the selection picked.
    const largest = allStats[0];
    const dataAsOf = `${year.dataYear}-12-31`;
    const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });
    const selectedRatio = topStats.reduce((s, t) => s + t.medicarePayment, 0) / topStats.reduce((s, t) => s + t.submittedCharges, 0);

    const summary = selected
      .map(({ stats, rationale }) => `${stats.providerType}: ${describe(stats)}${source === "llm" ? ` — ${rationale}` : ""}`)
      .join("; ");
    const selectionNote =
      source === "llm" ? ` Candidate selection method: model-reasoned salience ranking over all ${allStats.length} provider types.` : "";
    const scope = source === "llm" ? `the ${topStats.length} provider types selected as most noteworthy` : `the ${topStats.length} provider types Medicare paid most`;

    const insight: Insight = {
      id: `sig-reimbursement-${year.dataYear}-payment-vs-charge-by-provider-type`,
      headline: `Across ${scope} in ${year.dataYear}, Medicare paid ${(selectedRatio * 100).toFixed(0)}% of submitted charges — ${largest.providerType} received the most Medicare payment.`,
      questionId: "Q031",
      signalType: "baseline",
      period: { start: `${year.dataYear}-01-01`, end: dataAsOf },
      population: "medicare-ffs",
      geography: { level: "national", code: "US", label: "United States (all providers)" },
      magnitude: {
        value: largest.paymentToChargeRatio * 100,
        unit: "percent",
        comparedTo: `${largest.providerType} total submitted charges`,
      },
      drivers: [
        {
          description: `Per-provider-type totals across all ${year.providerCount.toLocaleString()} Part B providers in ${year.dataYear} (types with at least ${MIN_PROVIDERS_PER_TYPE} providers): ${summary}.${selectionNote}`,
          supportingEvidenceIds: ["ev-phy-summary"],
          relationship: "correlation",
        },
      ],
      businessRelevance:
        "Establishes a CMS-published payment benchmark by provider type - the public benchmark a plan or provider group would compare its own contracted rates against.",
      evidence: [
        {
          id: "ev-phy-summary",
          sourceId: SOURCE_ID,
          description: `CMS Medicare Physician & Other Practitioners - by Provider, every provider in data year ${year.dataYear} (${year.providerCount.toLocaleString()} providers), summarized at pull time`,
          datasetVintage: dataAsOf,
        },
      ],
      contradictoryEvidence: [],
      confidence: confidence.level,
      confidenceRationale: `${confidence.rationale} Full national population for ${year.dataYear}; a single year's ratio is a baseline, not a trend.`,
      freshness: { dataAsOf, generatedAt: new Date().toISOString(), isStale: false },
      limitations: [
        "Covers every Medicare fee-for-service Part B provider nationally, but not Medicare Advantage or commercial payments.",
        "Payment-to-charge ratio reflects Medicare's fee-schedule-driven payment, not a negotiated commercial rate - submitted charge is a provider's list price, not a market price.",
        `Provider types with fewer than ${MIN_PROVIDERS_PER_TYPE} providers are left out, since a ratio over a few providers swings on a handful of large billers.`,
      ],
      nextSignal: `Watch whether these ratios shift when CMS publishes ${year.dataYear + 1} data - a falling ratio means charges are growing faster than Medicare pays.`,
      recommendedInternalValidation: "Compare against a real payer's own contracted/allowed-amount data if this is ever used for anything beyond portfolio demonstration - this is a public FFS benchmark only.",
      sourceIds: [SOURCE_ID],
      generatingAgent: AGENT_ID,
      chart: {
        type: "bar",
        title: `Medicare payment as % of submitted charges, by provider type (${year.dataYear})`,
        unit: "% of charges",
        bars: topStats.map((s) => ({ label: s.providerType, value: Math.round(s.paymentToChargeRatio * 100) })),
      },
    };

    return [validateInsight(insight)];
  },
};
