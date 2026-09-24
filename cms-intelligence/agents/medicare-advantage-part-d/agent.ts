/**
 * Medicare Advantage & Part D Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 6. Also jointly
 * owns Q096-Q101 (Pharmacy & Part D economics) per routing.ts.
 *
 * Wired 2026-09-23 to the first real data source this agent has had:
 * CMS's "Monthly Enrollment by Plan" file (see
 * cms-intelligence/data/adapters/maPartDEnrollment.ts for how it was
 * verified live and pulled - a different platform from the other 3 real
 * CMS sources, since MA/Part D enrollment isn't in the Provider Data
 * Catalog). Q096-Q101 (pharmacy/drug-level economics) stay unaddressed -
 * this file has no drug-level data, only plan-level enrollment.
 *
 * NAMING/PRIVACY (revised 2026-09-24): the real source file has a named
 * organization/plan per row; the adapter drops lower-level plan/contract
 * fields but keeps parentOrganization and organizationMarketingName (see
 * that file's header for the current rule). This agent's plan-type-mix
 * and Part-D-attachment signals still aggregate only by category, never
 * naming an organization - but buildParentOrganizationRankingSignal below
 * does name real parent organizations, because a market-share-by-carrier
 * ranking computed from this real CMS enrollment data is a genuine,
 * sourced finding (the same kind of ranking a real industry directory
 * like AIS Health publishes), not a fabricated or implied-proprietary
 * claim - satisfying CLAUDE.md's binding rule as revised, not violating it.
 *
 * First agent to use the new salience/triage reasoning layer
 * (cms-intelligence/intelligence/salience/selectNoteworthy.ts, added the
 * same day after Adam asked why every agent's "what's worth surfacing"
 * logic was a fixed top-N rule): the plan-type mix insight computes ALL
 * real plan-type shares as candidates, then asks selectNoteworthy to
 * choose the most noteworthy subset - deterministic top-N by enrollment
 * when no model is configured (true today, so this ships with identical
 * real-number output either way), model-reasoned when one is.
 */
import { loadLatestSnapshot, SOURCE_ID, type MaPartDPlanRow } from "../../data/adapters/maPartDEnrollment";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence } from "../../intelligence/trends/trend";
import type { AgentContext, DomainAgent } from "../types";

const AGENT_ID = "medicare-advantage-part-d-intelligence";
const TOP_N_PLAN_TYPES = 5;
const TOP_N_PARENT_ORGS = 10;

function sumByKey(rows: MaPartDPlanRow[], key: "organizationType" | "planType"): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row[key]) continue;
    totals.set(row[key], (totals.get(row[key]) ?? 0) + row.enrollment);
  }
  return totals;
}

function baselineConfidence() {
  return classifyConfidence({ persistenceMet: false, hasFullBaseline: false, hasExternalCorroboration: false });
}

export const medicareAdvantagePartDAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: [
    "Q046", "Q047", "Q048", "Q049", "Q050", "Q051", "Q052", "Q053", "Q054", "Q055",
    "Q096", "Q097", "Q098", "Q099", "Q100", "Q101",
  ],

  async run(ctx: AgentContext): Promise<Insight[]> {
    const snapshot = loadLatestSnapshot();
    if (!snapshot || snapshot.rows.length === 0) return [];

    const insights: Insight[] = [];
    const planTypeInsight = await buildPlanTypeMixSignal(snapshot.rows, snapshot.reportPeriod, snapshot.rowCount, snapshot.suppressedRowCount, ctx);
    if (planTypeInsight) insights.push(planTypeInsight);
    const partDInsight = buildPartDAttachmentSignal(snapshot.rows, snapshot.reportPeriod);
    if (partDInsight) insights.push(partDInsight);
    const parentOrgInsight = await buildParentOrganizationRankingSignal(
      snapshot.rows,
      snapshot.reportPeriod,
      snapshot.rowCount,
      snapshot.suppressedRowCount,
      ctx
    );
    if (parentOrgInsight) insights.push(parentOrgInsight);

    return insights;
  },
};

async function buildPlanTypeMixSignal(
  rows: MaPartDPlanRow[],
  reportPeriod: string,
  rowCount: number,
  suppressedRowCount: number,
  ctx: AgentContext
): Promise<Insight | null> {
  const byPlanType = sumByKey(rows, "planType");
  if (byPlanType.size === 0) return null;
  const totalEnrollment = Array.from(byPlanType.values()).reduce((s, v) => s + v, 0);

  const candidates: Candidate[] = Array.from(byPlanType.entries()).map(([planType, enrollment]) => ({
    id: planType,
    label: planType,
    summary: `${enrollment.toLocaleString()} enrollees (${((enrollment / totalEnrollment) * 100).toFixed(1)}% of ${totalEnrollment.toLocaleString()} total)`,
    primaryMetric: enrollment,
  }));

  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_PLAN_TYPES, taskDescription: "Medicare Advantage & Part D plan-type enrollment mix this cycle" },
    ctx
  );
  if (selections.length === 0) return null;

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const selected = selections.map((s) => ({ selection: s, candidate: byId.get(s.candidateId)! })).filter((x) => x.candidate);
  const summary = selected.map(({ selection, candidate }) => `${candidate.label}: ${candidate.summary} — ${selection.rationale}`).join("; ");
  // The headline's "largest by enrollment" claim must hold regardless of how selectNoteworthy ordered its picks (an LLM-reasoned selection may rank by "noteworthy," not raw volume) - compute it independently rather than assuming selected[0] is the largest.
  const largestByEnrollment = candidates.reduce((a, b) => (b.primaryMetric > a.primaryMetric ? b : a));
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-ma-partd-${reportPeriod}-plan-type-mix`,
    headline: `${largestByEnrollment.label} is the largest Medicare Advantage/Part D plan type by enrollment (${((largestByEnrollment.primaryMetric / totalEnrollment) * 100).toFixed(0)}% of ${totalEnrollment.toLocaleString()} total enrollees), per CMS's ${reportPeriod} report.`,
    questionId: "Q049",
    signalType: "baseline",
    period: { start: `${reportPeriod}-01`, end: `${reportPeriod}-01` },
    population: "medicare-advantage",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: {
      value: largestByEnrollment.primaryMetric,
      unit: "enrollees",
      comparedTo: `total MA/Part D enrollment (${totalEnrollment.toLocaleString()})`,
      deltaPercent: (largestByEnrollment.primaryMetric / totalEnrollment) * 100,
    },
    drivers: [
      {
        description: `Real plan-type enrollment from CMS's ${reportPeriod} Monthly Enrollment by Plan file (${rowCount} plan rows, ${suppressedRowCount} suppressed at ≤10 enrollees and excluded): ${summary}. Candidate selection method: ${source === "llm" ? "model-reasoned salience ranking over all real plan types" : "deterministic top-N by enrollment"}.`,
        supportingEvidenceIds: ["ev-ma-partd-snapshot"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "A real, national baseline read on how Medicare Advantage/Part D enrollment is distributed across plan structures (HMO, PPO, PDP, etc.) - the starting point for any future plan-structure or benefit-design competitive read (Q049), never attributed to a specific named carrier by design (see this agent's file header).",
    evidence: [
      {
        id: "ev-ma-partd-snapshot",
        sourceId: SOURCE_ID,
        description: `CMS Monthly Enrollment by Plan, ${reportPeriod}, ${rowCount} real plan rows nationally`,
        datasetVintage: `${reportPeriod}-01`,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} This is the first real snapshot of this dataset this agent has pulled - no prior pull exists yet to assess persistence or build a baseline.`,
    freshness: { dataAsOf: `${reportPeriod}-01`, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "Plan-level enrollment aggregated nationally - no state/county geography is in this file, so Q046-Q048 (geographic enrollment/penetration questions) stay unaddressed by this insight.",
      "Never attributes enrollment to a named organization or plan - only category-level Organization Type/Plan Type fields are used, by deliberate design (see this agent's file header).",
      `${suppressedRowCount} of ${rowCount + suppressedRowCount} real plan rows were suppressed by CMS itself (≤10 enrollees, HIPAA small-cell rule) and excluded, not imputed.`,
      "Single snapshot - a baseline reading, not yet a trend across periods.",
    ],
    nextSignal: "Watch this plan-type mix across a second real pull for the first genuine month-over-month shift, which is what would move this from baseline to a real trend read.",
    recommendedInternalValidation: "Not applicable - this is public aggregate enrollment data, not tied to any specific payer's book of business.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Medicare Advantage/Part D enrollment by plan type, ${reportPeriod}`,
      unit: "enrollees",
      bars: selected.map(({ candidate }) => ({ label: candidate.label, value: candidate.primaryMetric })),
    },
  };

  return validateInsight(insight);
}

/**
 * Real parent-organization enrollment ranking - the same kind of
 * market-share-by-carrier reading a real industry directory (e.g. AIS
 * Health) publishes from this same CMS data. Names real carriers because
 * it is a genuine, sourced finding, not a fabricated or
 * implied-proprietary claim - see this file's header for the revised
 * naming/privacy rule.
 */
async function buildParentOrganizationRankingSignal(
  rows: MaPartDPlanRow[],
  reportPeriod: string,
  rowCount: number,
  suppressedRowCount: number,
  ctx: AgentContext
): Promise<Insight | null> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.parentOrganization) continue;
    totals.set(row.parentOrganization, (totals.get(row.parentOrganization) ?? 0) + row.enrollment);
  }
  if (totals.size === 0) return null;
  const totalEnrollment = Array.from(totals.values()).reduce((s, v) => s + v, 0);

  const candidates: Candidate[] = Array.from(totals.entries()).map(([parentOrganization, enrollment]) => ({
    id: parentOrganization,
    label: parentOrganization,
    summary: `${enrollment.toLocaleString()} enrollees (${((enrollment / totalEnrollment) * 100).toFixed(1)}% of ${totalEnrollment.toLocaleString()} total)`,
    primaryMetric: enrollment,
  }));

  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_PARENT_ORGS, taskDescription: "Medicare Advantage & Part D enrollment by parent organization this cycle" },
    ctx
  );
  if (selections.length === 0) return null;

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const selected = selections.map((s) => ({ selection: s, candidate: byId.get(s.candidateId)! })).filter((x) => x.candidate);
  const summary = selected.map(({ selection, candidate }) => `${candidate.label}: ${candidate.summary} — ${selection.rationale}`).join("; ");
  // Independent of selectNoteworthy's ordering, same discipline as buildPlanTypeMixSignal above.
  const leader = candidates.reduce((a, b) => (b.primaryMetric > a.primaryMetric ? b : a));
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-ma-partd-${reportPeriod}-parent-org-ranking`,
    headline: `${leader.label} leads Medicare Advantage/Part D enrollment with ${leader.primaryMetric.toLocaleString()} enrollees (${((leader.primaryMetric / totalEnrollment) * 100).toFixed(1)}% of ${totalEnrollment.toLocaleString()} national total), per CMS's ${reportPeriod} report.`,
    questionId: "Q046",
    signalType: "baseline",
    period: { start: `${reportPeriod}-01`, end: `${reportPeriod}-01` },
    population: "medicare-advantage",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: {
      value: leader.primaryMetric,
      unit: "enrollees",
      comparedTo: `total MA/Part D enrollment (${totalEnrollment.toLocaleString()})`,
      deltaPercent: (leader.primaryMetric / totalEnrollment) * 100,
    },
    drivers: [
      {
        description: `Real enrollment summed by CMS's own "Parent Organization" field, ${reportPeriod} Monthly Enrollment by Plan file (${rowCount} plan rows, ${suppressedRowCount} suppressed at ≤10 enrollees and excluded): ${summary}. Candidate selection method: ${source === "llm" ? "model-reasoned salience ranking over all real parent organizations" : "deterministic top-N by enrollment"}.`,
        supportingEvidenceIds: ["ev-ma-partd-parent-org-snapshot"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "A real, national market-share baseline by parent organization (Q046) - the same kind of ranking a real industry directory like AIS Health publishes from this same public CMS data, not this project's own proprietary read on any carrier's book of business.",
    evidence: [
      {
        id: "ev-ma-partd-parent-org-snapshot",
        sourceId: SOURCE_ID,
        description: `CMS Monthly Enrollment by Plan, ${reportPeriod}, ${rowCount} real plan rows nationally, summed by the file's own "Parent Organization" field`,
        datasetVintage: `${reportPeriod}-01`,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} This is the first real snapshot of this dataset this agent has pulled - no prior pull exists yet to assess persistence or build a baseline.`,
    freshness: { dataAsOf: `${reportPeriod}-01`, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "Plan-level enrollment aggregated nationally by parent organization - no state/county geography in this file.",
      "A parent organization can own multiple consumer-facing brands; this reading rolls all of a parent's contracts together, not brand-by-brand.",
      `${suppressedRowCount} of ${rowCount + suppressedRowCount} real plan rows were suppressed by CMS itself (≤10 enrollees, HIPAA small-cell rule) and excluded, not imputed.`,
      "Single snapshot - a baseline reading, not yet a trend across periods.",
      "A real, sourced market-share reading, not this project's own claim to any carrier's internal/proprietary data - see this file's header.",
    ],
    nextSignal: "Watch this ranking across a second real pull for the first genuine month-over-month share shift, which is what would move this from baseline to a real trend read.",
    recommendedInternalValidation: "Not applicable - this is public aggregate enrollment data, not tied to any specific payer's book of business.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Medicare Advantage/Part D enrollment by parent organization, ${reportPeriod}`,
      unit: "enrollees",
      bars: selected.map(({ candidate }) => ({ label: candidate.label, value: candidate.primaryMetric })),
    },
  };

  return validateInsight(insight);
}

function buildPartDAttachmentSignal(rows: MaPartDPlanRow[], reportPeriod: string): Insight | null {
  let offersPartD = 0;
  let doesNotOfferPartD = 0;
  for (const row of rows) {
    if (row.offersPartD === "Yes") offersPartD += row.enrollment;
    else doesNotOfferPartD += row.enrollment;
  }
  const total = offersPartD + doesNotOfferPartD;
  if (total === 0) return null;

  const attachmentPct = (offersPartD / total) * 100;
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-ma-partd-${reportPeriod}-part-d-attachment`,
    headline: `${attachmentPct.toFixed(0)}% of Medicare Advantage/Part D enrollees (${offersPartD.toLocaleString()} of ${total.toLocaleString()}) are in a plan that offers a Part D drug benefit, per CMS's ${reportPeriod} report.`,
    questionId: "Q053",
    signalType: "baseline",
    period: { start: `${reportPeriod}-01`, end: `${reportPeriod}-01` },
    population: "part-d",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: attachmentPct, unit: "percent", comparedTo: `total MA/Part D enrollment (${total.toLocaleString()})` },
    drivers: [
      {
        description: `Real enrollment split by CMS's own "Offers Part D" field: ${offersPartD.toLocaleString()} enrollees in Part-D-offering plans vs. ${doesNotOfferPartD.toLocaleString()} in plans that don't.`,
        supportingEvidenceIds: ["ev-ma-partd-attachment"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "A real baseline read on how much of the MA/Part D market carries an attached drug benefit vs. medical-only coverage - relevant context for Part D economics questions (Q053), distinct from the medical-benefit mechanics MA plans separately negotiate.",
    evidence: [
      {
        id: "ev-ma-partd-attachment",
        sourceId: SOURCE_ID,
        description: `CMS Monthly Enrollment by Plan, ${reportPeriod}, real "Offers Part D" field summed across all plan rows nationally`,
        datasetVintage: `${reportPeriod}-01`,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} This is the first real snapshot of this dataset this agent has pulled - no prior pull exists yet to assess persistence or build a baseline.`,
    freshness: { dataAsOf: `${reportPeriod}-01`, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "A plan 'offering' Part D is a benefit-design flag, not proof every enrollee is actively using a drug benefit.",
      "National aggregate only - no state-level or plan-type cross-tab included in this specific reading.",
      "Single snapshot - a baseline reading, not yet a trend across periods.",
    ],
    nextSignal: "Watch this attachment rate across a second real pull for a genuine shift, which would be a real signal about benefit-design trends in the market.",
    recommendedInternalValidation: "Not applicable - this is public aggregate enrollment data, not tied to any specific payer's book of business.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "donut",
      title: `Part D attachment, MA/Part D enrollment, ${reportPeriod}`,
      unit: "enrollees",
      slices: [
        { label: "Offers Part D", value: offersPartD },
        { label: "No Part D benefit", value: doesNotOfferPartD },
      ],
    },
  };

  return validateInsight(insight);
}
