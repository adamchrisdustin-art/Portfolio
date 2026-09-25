/**
 * Policy, Regulation & CMS Program Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 9. Also jointly
 * owns Q102-Q107 (Value-Based Care) per routing.ts's assignment to
 * provider-network - this agent contributes the CMMI/MSSP program-level
 * side per AGENT_ARCHITECTURE.md, invoked directly by callers who need
 * that specific angle rather than through the routing table.
 *
 * Wired 2026-09-23 to the first real data source this agent has had:
 * the Federal Register API, filtered to CMS as the publishing agency
 * (see cms-intelligence/data/adapters/federalRegisterDocuments.ts for
 * verification detail and pull scope). Per AGENT_ARCHITECTURE.md's own
 * "LLM vs. code split" for this agent, effective-date and rule-status
 * tracking (Q074-Q076) is exactly the deterministic, code-only part -
 * this implementation covers that. Q077-Q080 (which domain a rule
 * routes to - payment/providers/beneficiaries/utilization) and the
 * impact narrative are explicitly named in that same doc as the LLM
 * step, gated behind a live model provider per AGENT_ARCHITECTURE.md's
 * cost-gate rule - not implemented here to avoid fabricating a routing
 * judgment code can't make. Q081-Q084 (program expansion/contraction,
 * new-program monitoring, claims-lag bridging) need semantic
 * interpretation this dataset's structured fields don't support on
 * their own, so they stay unaddressed rather than guessed at.
 *
 * Which rules each insight lists goes through the salience layer
 * (intelligence/salience/selectNoteworthy.ts, retrofitted 2026-09-24).
 * Every selection here is recency/proximity-based, so each call uses
 * direction "lowest" (fewest days since publication, or fewest days
 * until effective) - with no model configured that reproduces this
 * agent's original most-recent-first / nearest-first lists exactly.
 * Headline facts ("most recently X", "the nearest is Y") are computed
 * from the full sorted list, never from the selection.
 */
import { loadLatestSnapshot, SOURCE_ID, type FederalRegisterDocument } from "../../data/adapters/federalRegisterDocuments";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence } from "../../intelligence/trends/trend";
import type { AgentContext, DomainAgent } from "../types";

const AGENT_ID = "policy-regulation-cms-program-intelligence";
const TOP_N = 6;
const MS_PER_DAY = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / MS_PER_DAY);
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7); // YYYY-MM
}

// One confidence read for every insight this agent produces this cycle:
// a single Federal Register snapshot has no prior pull to compare
// against, so persistence and baseline can't be assessed yet - same
// honest floor reimbursementPaymentAgent uses for its own first
// snapshot.
function baselineConfidence() {
  return classifyConfidence({ persistenceMet: false, hasFullBaseline: false, hasExternalCorroboration: false });
}

interface SelectedRule {
  doc: FederalRegisterDocument;
  rationale: string;
}

/**
 * `docs` must already be in the original display order (most recent /
 * nearest first) - the deterministic fallback's stable sort on `metric`
 * then leaves same-day ties in exactly that order.
 */
async function selectRules(
  docs: FederalRegisterDocument[],
  metric: (d: FederalRegisterDocument) => number,
  describe: (d: FederalRegisterDocument) => string,
  taskDescription: string,
  ctx: AgentContext
): Promise<{ selected: SelectedRule[]; source: "llm" | "deterministic" }> {
  const candidates: Candidate[] = docs.map((d) => ({ id: d.documentNumber, label: d.title, summary: describe(d), primaryMetric: metric(d) }));
  const { selections, source } = await selectNoteworthy({ candidates, topN: TOP_N, taskDescription, direction: "lowest" }, ctx);
  const byId = new Map(docs.map((d) => [d.documentNumber, d]));
  const selected = selections.filter((s) => byId.has(s.candidateId)).map((s) => ({ doc: byId.get(s.candidateId)!, rationale: s.rationale }));
  return { selected, source };
}

function withRationale(text: string, rationale: string, source: "llm" | "deterministic"): string {
  return source === "llm" ? `${text} — ${rationale}` : text;
}

export const policyRegulationCmsAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: ["Q073", "Q074", "Q075", "Q076", "Q077", "Q078", "Q079", "Q080", "Q081", "Q082", "Q083", "Q084"],

  async run(ctx: AgentContext): Promise<Insight[]> {
    const snapshot = loadLatestSnapshot();
    if (!snapshot || snapshot.documents.length === 0) return [];

    const insights: Insight[] = [];
    const finalized = await buildFinalizedRulesSignal(snapshot.documents, snapshot.pulledAt, snapshot.windowStart, ctx);
    if (finalized) insights.push(finalized);
    const proposed = await buildProposedRulesSignal(snapshot.documents, snapshot.pulledAt, snapshot.windowStart, ctx);
    if (proposed) insights.push(proposed);
    const effective = await buildUpcomingEffectiveSignal(snapshot.documents, snapshot.pulledAt, snapshot.windowStart, ctx);
    if (effective) insights.push(effective);

    return insights;
  },
};

async function buildFinalizedRulesSignal(
  documents: FederalRegisterDocument[],
  pulledAt: string,
  windowStart: string,
  ctx: AgentContext
): Promise<Insight | null> {
  const stamp = pulledAt.slice(0, 10);
  const rules = documents.filter((d) => d.type === "Rule").sort((a, b) => (a.publicationDate < b.publicationDate ? 1 : -1));
  if (rules.length === 0) return null;

  const byMonth = new Map<string, number>();
  for (const r of rules) byMonth.set(monthKey(r.publicationDate), (byMonth.get(monthKey(r.publicationDate)) ?? 0) + 1);
  const monthBars = Array.from(byMonth.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const describe = (r: FederalRegisterDocument) => `published ${r.publicationDate}, effective ${r.effectiveOn ?? "date not yet set"}`;
  const { selected, source } = await selectRules(
    rules,
    (r) => daysBetween(stamp, r.publicationDate),
    describe,
    "recently finalized CMS rules this cycle",
    ctx
  );
  const summary = selected.map(({ doc, rationale }) => withRationale(`"${doc.title}" (${describe(doc)})`, rationale, source)).join("; ");
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-policy-${stamp}-finalized-rules`,
    headline: `CMS finalized ${rules.length} rule${rules.length === 1 ? "" : "s"} in the last ${daysBetween(stamp, windowStart)} days — most recently "${rules[0].title}" on ${rules[0].publicationDate}.`,
    questionId: "Q074",
    signalType: "policy",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: {
      value: rules.length,
      unit: "count",
      comparedTo: `${documents.length} total CMS Federal Register documents in the same window`,
    },
    drivers: [
      {
        description:
          source === "llm"
            ? `Real finalized rules from the Federal Register, selected by model-reasoned salience ranking over all ${rules.length}: ${summary}.`
            : `Real finalized rules from the Federal Register, most recent first: ${summary}.`,
        supportingEvidenceIds: ["ev-fr-rules"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Distinguishes what CMS has actually finalized — and is therefore binding — from what's merely proposed (see the companion proposed-rules signal below), which is the master orchestrator's single most emphasized policy-analysis rule. Which specific domain(s) each rule affects (payment, providers, beneficiaries, utilization — Q077-Q080) is a routing judgment reserved for this agent's LLM step, not yet run here.",
    evidence: [
      {
        id: "ev-fr-rules",
        sourceId: SOURCE_ID,
        description: `Federal Register API, CMS agency filter, ${rules.length} finalized rules published ${windowStart} to ${stamp}`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} This is the first real Federal Register snapshot this agent has pulled — no prior pull exists yet to assess persistence or build a baseline.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Bounded to CMS-attributed documents published in the trailing ${daysBetween(stamp, windowStart)} days, not full regulatory history.`,
      "Does not yet determine which domain(s) (payment, providers, beneficiaries, utilization) each rule actually affects — that routing judgment is this agent's LLM step, gated behind a live model provider and not run for this dashboard cycle (see COST_AND_OPERATING_MODEL.md).",
      "A rule being 'finalized' here means it appeared in the Federal Register with type=Rule — it does not yet confirm downstream claims-level or provider-behavior impact (Q084 stays unaddressed for that reason).",
    ],
    nextSignal: "Watch for whether these rules' effective dates arrive as scheduled, and whether a second real pull shows a new batch of finalizations (the persistence signal this agent can't yet compute from one snapshot).",
    recommendedInternalValidation: "Cross-check against a real payer's own regulatory-affairs tracking before treating any single rule here as fully assessed — this reflects only what's structurally present in the Federal Register API today.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart:
      monthBars.length > 0
        ? { type: "bar", title: "CMS rules finalized per month (trailing window)", unit: "rules", bars: monthBars.map(([label, value]) => ({ label, value })) }
        : undefined,
  };

  return validateInsight(insight);
}

async function buildProposedRulesSignal(
  documents: FederalRegisterDocument[],
  pulledAt: string,
  windowStart: string,
  ctx: AgentContext
): Promise<Insight | null> {
  const stamp = pulledAt.slice(0, 10);
  const proposed = documents.filter((d) => d.type === "Proposed Rule").sort((a, b) => (a.publicationDate < b.publicationDate ? 1 : -1));
  if (proposed.length === 0) return null;

  const stillOpen = proposed.filter((d) => d.commentsCloseOn && d.commentsCloseOn >= stamp);
  const commentStatus = (r: FederalRegisterDocument) =>
    `comment period ${r.commentsCloseOn ? (r.commentsCloseOn >= stamp ? `open through ${r.commentsCloseOn}` : `closed ${r.commentsCloseOn}`) : "date not published"}`;
  const daysSincePublished = (r: FederalRegisterDocument) => daysBetween(stamp, r.publicationDate);
  const describe = (r: FederalRegisterDocument) => `published ${r.publicationDate}, ${commentStatus(r)}`;
  const task = "proposed (not yet final) CMS rules this cycle";
  const { selected, source } = await selectRules(proposed, daysSincePublished, describe, task, ctx);
  // The chart only plots rules with a real comment-close date, so it draws from that narrower candidate pool.
  const { selected: chartSelected, source: chartSource } = await selectRules(
    proposed.filter((r) => r.commentsCloseOn),
    daysSincePublished,
    describe,
    `${task}, by comment-period status`,
    ctx
  );
  const summary = selected.map(({ doc, rationale }) => withRationale(`"${doc.title}" (${commentStatus(doc)})`, rationale, source)).join("; ");
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-policy-${stamp}-proposed-rules`,
    headline: `${proposed.length} CMS rule${proposed.length === 1 ? " is" : "s are"} currently proposed but not yet final — ${stillOpen.length} still ${stillOpen.length === 1 ? "has" : "have"} an open comment period.`,
    questionId: "Q075",
    signalType: "policy",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: {
      value: proposed.length,
      unit: "count",
      comparedTo: `${documents.length} total CMS Federal Register documents in the same window`,
    },
    drivers: [
      {
        description:
          source === "llm"
            ? `Real proposed (not yet final) rules from the Federal Register, selected by model-reasoned salience ranking over all ${proposed.length}: ${summary}.`
            : `Real proposed (not yet final) rules from the Federal Register, most recent first: ${summary}.`,
        supportingEvidenceIds: ["ev-fr-proposed"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "These are explicitly proposals, not decided policy — CMS can and does change substance between a proposed and final rule, per this system's standing rule to never present a proposal as settled. Tracking them separately from finalized rules prevents premature operational planning against a rule that could still change.",
    evidence: [
      {
        id: "ev-fr-proposed",
        sourceId: SOURCE_ID,
        description: `Federal Register API, CMS agency filter, ${proposed.length} proposed rules published ${windowStart} to ${stamp}`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} This is the first real Federal Register snapshot this agent has pulled — no prior pull exists yet to assess persistence or build a baseline.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "A closed comment period does not mean a final rule is imminent — CMS sets no fixed deadline between comment close and finalization, and this system does not estimate one.",
      "Proposed rules with no published comments_close_on (e.g. requests for information) are included in the count but excluded from the 'still open' figure.",
      "Must never be read as a forecast of what the final rule will say — only that a proposal exists and is not yet decided.",
    ],
    nextSignal: "Watch whether each proposed rule here is later matched by a real finalized rule with the same or a related title in a future pull — that pairing, once observed, is the actual proposed-to-final signal this system can then report on.",
    recommendedInternalValidation: "If any proposed rule here is operationally relevant, confirm status directly against regulations.gov or CMS's own rulemaking tracker before acting — this reflects only what's structurally present in the Federal Register API today.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title:
        chartSource === "llm"
          ? "Days since comment period closed (negative = still open), proposed CMS rules selected as most noteworthy"
          : "Days since comment period closed (negative = still open), proposed CMS rules",
      unit: "days",
      bars: chartSelected.map(({ doc }) => ({ label: doc.documentNumber, value: daysBetween(stamp, doc.commentsCloseOn as string) })),
    },
  };

  return validateInsight(insight);
}

async function buildUpcomingEffectiveSignal(
  documents: FederalRegisterDocument[],
  pulledAt: string,
  windowStart: string,
  ctx: AgentContext
): Promise<Insight | null> {
  const stamp = pulledAt.slice(0, 10);
  const upcoming = documents
    .filter((d) => d.effectiveOn && d.effectiveOn >= stamp)
    .sort((a, b) => ((a.effectiveOn as string) < (b.effectiveOn as string) ? -1 : 1));
  if (upcoming.length === 0) return null;

  const daysOut = (r: FederalRegisterDocument) => daysBetween(r.effectiveOn as string, stamp);
  const describe = (r: FederalRegisterDocument) => `effective ${r.effectiveOn}, ${daysOut(r)} days out`;
  const { selected, source } = await selectRules(upcoming, daysOut, describe, "upcoming CMS rule effective dates (operational-readiness calendar) this cycle", ctx);
  const summary = selected.map(({ doc, rationale }) => withRationale(`"${doc.title}" (${describe(doc)})`, rationale, source)).join("; ");
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-policy-${stamp}-upcoming-effective`,
    headline: `${upcoming.length} finalized CMS rule${upcoming.length === 1 ? "" : "s"} become${upcoming.length === 1 ? "s" : ""} effective in the next ${daysBetween(upcoming[upcoming.length - 1].effectiveOn as string, stamp)} days — the nearest is "${upcoming[0].title}" on ${upcoming[0].effectiveOn}.`,
    questionId: "Q076",
    signalType: "policy",
    period: { start: stamp, end: upcoming[upcoming.length - 1].effectiveOn as string },
    population: "n/a",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: {
      value: daysBetween(upcoming[0].effectiveOn as string, stamp),
      unit: "days-until-effective",
      comparedTo: upcoming[0].title,
    },
    drivers: [
      {
        description:
          source === "llm"
            ? `Real finalized rules with a future effective date, selected by model-reasoned salience ranking over all ${upcoming.length}: ${summary}.`
            : `Real finalized rules with a future effective date, nearest first: ${summary}.`,
        supportingEvidenceIds: ["ev-fr-effective"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "A forward operational-readiness calendar — rules on this list are already finalized (not proposals) and will become binding on their stated date, giving a real lead time to prepare rather than reacting after the fact.",
    evidence: [
      {
        id: "ev-fr-effective",
        sourceId: SOURCE_ID,
        description: `Federal Register API, CMS agency filter, ${upcoming.length} finalized rules with a future effective date as of ${stamp}`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} This is the first real Federal Register snapshot this agent has pulled — no prior pull exists yet to assess persistence or build a baseline.`,
    limitations: [
      "Only rules already finalized are included — proposed rules with no effective date are covered separately (see the proposed-rules signal) and are explicitly excluded here.",
      `Limited to the ${daysBetween(stamp, windowStart)}-day publication window this pull covers — a rule published earlier with a still-future effective date would not appear here if it fell outside that window.`,
    ],
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    nextSignal: "Watch each of these effective dates arrive on schedule in a future pull — a rule that fails to take effect as stated would itself be a notable signal.",
    recommendedInternalValidation: "Confirm against internal compliance/regulatory-affairs tracking for any rule here that requires operational readiness by its effective date.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      // A linked bullet list, not a bar chart - redesigned 2026-09-24
      // after Adam pointed out that a bar chart keyed by opaque document
      // numbers didn't convey the actually useful content (what the
      // rules are, and where to read them). Each item is the rule's real
      // title, its real effective date, and a real link to the Federal
      // Register's own page for it - never a fabricated summary.
      type: "list",
      title: source === "llm" ? "Upcoming finalized CMS rules selected as most noteworthy" : "Upcoming finalized CMS rules, by effective date",
      items: selected.map(({ doc }) => ({
        label: doc.title,
        detail: `Effective ${doc.effectiveOn} (${daysOut(doc)} days out)`,
        url: doc.htmlUrl,
      })),
    },
  };

  return validateInsight(insight);
}
