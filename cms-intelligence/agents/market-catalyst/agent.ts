/**
 * Market/Catalyst Intelligence agent - the 12th domain agent, added
 * 2026-09-24. Owns Q113-Q124, a new category not in the original
 * EXECUTIVE_QUESTION_CATALOG.md 112-question set: real corporate-filing,
 * drug-approval, federal-grant, and clinical-trial-results activity
 * across a fixed watchlist of publicly traded health insurers and the
 * broader biopharma/NIH ecosystem they operate in - the "what just
 * happened in the market that could matter to a payer executive"
 * read, distinct from every other agent's CMS-program-data focus.
 *
 * Four brand-new real data sources, one per build*Signal group below:
 *   - SEC EDGAR 8-K filings for a hardcoded watchlist of 6 publicly
 *     traded health insurers (data/adapters/secEdgarFilings.ts)
 *   - openFDA novel drug (new molecular entity) approvals
 *     (data/adapters/fdaDrugApprovals.ts)
 *   - NIH RePORTER award notices (data/adapters/nihReporterAwards.ts)
 *   - ClinicalTrials.gov industry-sponsored Phase 3 results postings
 *     (data/adapters/clinicalTrialsResults.ts)
 * Each is loaded independently below - a missing snapshot for one source
 * only skips that source's insights, never the whole agent (same
 * per-source isolation fullSweep.ts already applies per-agent).
 *
 * NAMING/HONESTY RULES BINDING ON THIS AGENT (see CLAUDE.md and
 * AGENT_ARCHITECTURE.md's revised 2026-09-24 real-carrier-naming rule -
 * this is the third real use of that rule, after MA/Part D's
 * parent-organization ranking and Marketplace's issuer-ID discussion):
 *   - A real carrier/company/organization name appears in these insights
 *     ONLY as a genuine, sourced finding computed from real data (a real
 *     8-K filing, a real FDA approval record, a real NIH award, a real
 *     posted trial result) - never fabricated, never editorialized.
 *   - SEC Form 8-K Item 5.02 covers BOTH departure AND appointment of
 *     officers/directors - this agent never says "fired" or "resigned,"
 *     only "filed an 8-K Item 5.02 (departure or election of directors/
 *     principal officers)."
 *   - SEC Form 8-K Item 1.01 is "entry into a material definitive
 *     agreement" - covers far more than partnerships (credit facilities,
 *     leases, etc.) - never say "announced a partnership."
 *   - openFDA drugsfda has NO "breakthrough therapy" field - this agent
 *     never uses that word, only the real fields verbatim
 *     (`submissionClassCode`, `reviewPriority`).
 *   - A ClinicalTrials.gov results posting encodes no success/failure
 *     judgment - this agent never says "positive result," only that
 *     results were posted, by whom, with what real enrollment number.
 *
 * Second consumer of the salience/triage reasoning layer's `direction`
 * option is NOT needed here - every ranking below is "highest," so the
 * default is used throughout (unlike commercial-marketplace's
 * plan-availability insight, which needed `direction: "lowest"`).
 */
import { loadLatestSnapshot as loadSecSnapshot, SOURCE_ID as SEC_SOURCE_ID, TRACKED_COMPANIES, type SecFiling } from "../../data/adapters/secEdgarFilings";
import { loadLatestSnapshot as loadFdaSnapshot, SOURCE_ID as FDA_SOURCE_ID, type FdaApproval } from "../../data/adapters/fdaDrugApprovals";
import {
  loadLatestSnapshot as loadNihSnapshot,
  SOURCE_ID as NIH_SOURCE_ID,
  type NihAward,
  type NihAwardSummary,
  type NihReporterSnapshot,
} from "../../data/adapters/nihReporterAwards";
import { loadLatestSnapshot as loadCtSnapshot, SOURCE_ID as CT_SOURCE_ID, type ClinicalTrialResult } from "../../data/adapters/clinicalTrialsResults";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { tukeyBox } from "../../intelligence/metrics/metrics";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence } from "../../intelligence/trends/trend";
import type { AgentContext, DomainAgent } from "../types";

const AGENT_ID = "market-catalyst-intelligence";
const NATIONAL_GEO = { level: "national" as const, code: "US", label: "United States" };
const TOP_N_AWARDS = 10;
const TOP_N_ORGS = 10;
const TOP_N_INSTITUTES = 8;
const MIN_TRIALS_FOR_BOXPLOT = 20;
const TOP_N_THEMES = 12;
// A term present in more than this fraction of sampled awards is
// excluded as generic grant-administration language (e.g. "Research",
// "Data", "Development"), not a specific research theme - see
// buildResearchThemesSignal's header for the real distribution that
// justified this cutoff. A term present in fewer than 3 awards is
// excluded as too rare to be a real "theme" rather than a one-off.
const GENERIC_TERM_MAX_FRACTION = 0.2;
const MIN_TERM_AWARD_COUNT = 3;

function baselineConfidence() {
  return classifyConfidence({ persistenceMet: false, hasFullBaseline: false, hasExternalCorroboration: false });
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export const marketCatalystAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: [
    "Q113", "Q114", "Q115", "Q116",
    "Q117", "Q118", "Q119",
    "Q120", "Q121", "Q122",
    "Q123", "Q124", "Q129",
  ],

  async run(ctx: AgentContext): Promise<Insight[]> {
    const insights: Insight[] = [];

    const nihSnapshot = loadNihSnapshot();
    if (nihSnapshot && nihSnapshot.awards.length > 0) {
      const awardCount = await buildAwardCountSignal(nihSnapshot.awards, nihSnapshot.totalAvailable, nihSnapshot.pulledAt, nihSnapshot.windowStart, ctx);
      if (awardCount) insights.push(awardCount);
      const totalDollars = buildTotalAwardDollarsSignal(nihSnapshot);
      if (totalDollars) insights.push(totalDollars);
      const byAgency = await buildAwardsByAgencySignal(nihSnapshot, ctx);
      if (byAgency) insights.push(byAgency);
      const themes = buildResearchThemesSignal(nihSnapshot.awards, nihSnapshot.pulledAt, nihSnapshot.windowStart);
      if (themes) insights.push(themes);
      const topOrgs = await buildTopRecipientOrgsSignal(nihSnapshot.awards, nihSnapshot.totalAvailable, nihSnapshot.pulledAt, nihSnapshot.windowStart, ctx);
      if (topOrgs) insights.push(topOrgs);
    }

    const fdaSnapshot = loadFdaSnapshot();
    if (fdaSnapshot && fdaSnapshot.approvals.length > 0) {
      const nmeCount = buildNmeApprovalCountSignal(fdaSnapshot.approvals, fdaSnapshot.pulledAt, fdaSnapshot.windowStart);
      if (nmeCount) insights.push(nmeCount);
      const prioritySplit = buildReviewPrioritySplitSignal(fdaSnapshot.approvals, fdaSnapshot.pulledAt, fdaSnapshot.windowStart);
      if (prioritySplit) insights.push(prioritySplit);
      const byMonth = buildApprovalsByMonthSignal(fdaSnapshot.approvals, fdaSnapshot.pulledAt, fdaSnapshot.windowStart);
      if (byMonth) insights.push(byMonth);
    }

    const secSnapshot = loadSecSnapshot();
    if (secSnapshot && secSnapshot.filings.length > 0) {
      const leadershipByCompany = await buildLeadershipChangeByCompanySignal(secSnapshot.filings, secSnapshot.pulledAt, secSnapshot.windowStart, ctx);
      if (leadershipByCompany) insights.push(leadershipByCompany);
      const filingMix = buildFilingTypeMixSignal(secSnapshot.filings, secSnapshot.pulledAt, secSnapshot.windowStart);
      if (filingMix) insights.push(filingMix);
      const materialAgreementByCompany = await buildMaterialAgreementByCompanySignal(secSnapshot.filings, secSnapshot.pulledAt, secSnapshot.windowStart, ctx);
      if (materialAgreementByCompany) insights.push(materialAgreementByCompany);
    }

    const ctSnapshot = loadCtSnapshot();
    if (ctSnapshot && ctSnapshot.trials.length > 0) {
      const trialCount = buildTrialResultsCountSignal(ctSnapshot.trials, ctSnapshot.pulledAt, ctSnapshot.windowStart);
      if (trialCount) insights.push(trialCount);
      const enrollmentDist = buildEnrollmentDistributionSignal(ctSnapshot.trials, ctSnapshot.pulledAt, ctSnapshot.windowStart);
      if (enrollmentDist) insights.push(enrollmentDist);
    }

    return insights;
  },
};

// ---------------------------------------------------------------------------
// NIH RePORTER (Q113-Q116)
// ---------------------------------------------------------------------------

async function buildAwardCountSignal(
  awards: NihAward[],
  totalAvailable: number,
  pulledAt: string,
  windowStart: string,
  ctx: AgentContext
): Promise<Insight | null> {
  const stamp = pulledAt.slice(0, 10);

  const candidates: Candidate[] = awards.map((a) => ({
    id: a.projectNum,
    label: a.organization,
    summary: `$${a.awardAmount.toLocaleString()} to ${a.organization} for "${a.projectTitle}" (project ${a.projectNum}, notice dated ${a.awardNoticeDate})`,
    primaryMetric: a.awardAmount,
  }));

  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_AWARDS, taskDescription: "NIH award notices by dollar amount this cycle" },
    ctx
  );
  if (selections.length === 0) return null;

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const selected = selections.map((s) => ({ selection: s, candidate: byId.get(s.candidateId)! })).filter((x) => x.candidate);
  const largest = candidates.reduce((a, b) => (b.primaryMetric > a.primaryMetric ? b : a));
  const largestAward = awards.find((a) => a.projectNum === largest.id)!;
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-nih-award-count`,
    headline: `NIH issued ${awards.length.toLocaleString()} award notices (sampled by dollar amount from ${totalAvailable.toLocaleString()} total) between ${windowStart} and ${stamp}; the largest single award is $${largestAward.awardAmount.toLocaleString()} to ${largestAward.organization} for "${largestAward.projectTitle}", project ${largestAward.projectNum}, notice dated ${largestAward.awardNoticeDate}.`,
    questionId: "Q113",
    signalType: "structural-change",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: {
      value: awards.length,
      unit: "count",
      comparedTo: `${totalAvailable.toLocaleString()} total real award notices reported by NIH RePORTER for this window`,
    },
    drivers: [
      {
        description: `Real NIH RePORTER award notices, top ${TOP_N_AWARDS} by dollar amount: ${selected.map(({ selection, candidate }) => `${candidate.summary} — ${selection.rationale}`).join("; ")}. Candidate selection method: ${source === "llm" ? "model-reasoned salience ranking over the real sampled award notices" : "deterministic top-N by award amount"}.`,
        supportingEvidenceIds: ["ev-nih-award-count"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Real, dollar-ranked NIH award activity is a direct catalyst signal for the biopharma/research ecosystem a payer executive tracks - large awards can precede new competitive research programs, novel therapy pipelines, or shifts in where NIH-funded research capacity is concentrating.",
    evidence: [
      {
        id: "ev-nih-award-count",
        sourceId: NIH_SOURCE_ID,
        description: `NIH RePORTER projects/search, ${awards.length} real sampled award notices (of ${totalAvailable.toLocaleString()} total), ${windowStart} to ${stamp}`,
        datasetVintage: stamp,
        url: largestAward.url,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each monthly pull recounts the trailing two-year window; a change counts as a trend only once it holds across consecutive pulls.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Bounded to the top ${awards.length} awards by dollar amount out of ${totalAvailable.toLocaleString()} real total award notices in this window - this list names the largest awards; the NIH total and by-institute findings cover every award.`,
      "An award notice is a real, real-dollar commitment, not a claim about the research's eventual clinical or commercial outcome.",
      "Single snapshot — a baseline reading, not yet a trend across periods.",
    ],
    nextSignal: "Watch this award count and its largest-award figure across a second real pull for the first genuine period-over-period shift in NIH funding activity.",
    recommendedInternalValidation: "Cross-check any award of direct strategic relevance against NIH RePORTER's own project page before treating it as fully assessed.",
    sourceIds: [NIH_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: "Top NIH award notices by dollar amount (trailing window)",
      unit: "usd",
      bars: selected.map(({ candidate }) => ({ label: candidate.label, value: candidate.primaryMetric })),
    },
  };

  return validateInsight(insight);
}

/** The last calendar month fully covered by the pull. */
function lastCompleteMonth(summary: NihAwardSummary, pulledAt: string): { month: string; notices: number; dollars: number } | null {
  const pullMonth = pulledAt.slice(0, 7);
  const complete = summary.byMonth.filter((m) => m.month < pullMonth);
  return complete[complete.length - 1] ?? null;
}

const billionsOf = (usd: number) => `$${(usd / 1e9).toFixed(2)}B`;

function buildTotalAwardDollarsSignal(snapshot: NihReporterSnapshot): Insight | null {
  const summary = snapshot.summary;
  if (!summary || summary.notices === 0) return null;
  const stamp = snapshot.pulledAt.slice(0, 10);
  const windowStart = snapshot.windowStart;
  const recent = lastCompleteMonth(summary, snapshot.pulledAt);
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-nih-total-dollars`,
    headline: `NIH issued ${summary.notices.toLocaleString()} award notices totaling ${billionsOf(summary.dollars)} between ${windowStart} and ${stamp}${recent ? `; ${recent.month} alone had ${recent.notices.toLocaleString()} notices worth ${billionsOf(recent.dollars)}` : ""}.`,
    questionId: "Q114",
    signalType: "structural-change",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: summary.dollars, unit: "usd", comparedTo: `all ${summary.notices.toLocaleString()} award notices in the window` },
    drivers: [
      {
        description: `Every NIH RePORTER award notice in the window, summed by month (${summary.byMonth.map((m) => `${m.month}: ${m.notices.toLocaleString()} notices, ${billionsOf(m.dollars)}`).join("; ")}).`,
        supportingEvidenceIds: ["ev-nih-total-dollars"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "The overall scale and monthly rhythm of NIH research funding - the upstream pipeline for the therapies and devices a payer will eventually cover. Sudden gaps show up here first.",
    evidence: [
      {
        id: "ev-nih-total-dollars",
        sourceId: NIH_SOURCE_ID,
        description: `NIH RePORTER projects/search, every award notice ${windowStart} to ${stamp} (${summary.notices.toLocaleString()} of ${summary.reportedTotal.toLocaleString()} reported), summarized at pull time`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Full-population counts, but NIH funding follows the federal fiscal year, so month-to-month swings are mostly seasonal.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `${summary.missingAmount.toLocaleString()} notices carry no award amount and count as $0.`,
      "Award notices are obligations, not money spent; a multi-year project can get several notices.",
      "The first and last months of the window are partial.",
      "NIH awards cluster before the September 30 fiscal year-end and slow sharply when federal funding lapses, so compare months year over year, not in sequence.",
    ],
    nextSignal: "Watch the year-over-year comparison of the same months for a real change in NIH funding pace.",
    recommendedInternalValidation: "Not applicable — this is public aggregate award data, not tied to any specific organization's actual research budget.",
    sourceIds: [NIH_SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: {
      label: "NIH award dollars by month",
      unit: "USD",
      points: summary.byMonth.map((m) => ({ date: `${m.month}-01`, value: Math.round(m.dollars) })),
    },
  };

  return validateInsight(insight);
}

async function buildAwardsByAgencySignal(snapshot: NihReporterSnapshot, ctx: AgentContext): Promise<Insight | null> {
  const summary = snapshot.summary;
  if (!summary || summary.notices === 0) return null;
  const stamp = snapshot.pulledAt.slice(0, 10);
  const windowStart = snapshot.windowStart;
  const totals = new Map<string, { notices: number; dollars: number }>();
  for (const r of summary.byMonthInstitute) {
    const t = totals.get(r.institute) ?? { notices: 0, dollars: 0 };
    t.notices += r.notices;
    t.dollars += r.dollars;
    totals.set(r.institute, t);
  }
  const totalDollars = summary.dollars;

  const candidates: Candidate[] = Array.from(totals.entries()).map(([institute, t]) => ({
    id: institute,
    label: institute,
    summary: `${billionsOf(t.dollars)} across ${t.notices.toLocaleString()} notices (${((t.dollars / totalDollars) * 100).toFixed(1)}% of ${billionsOf(totalDollars)})`,
    primaryMetric: t.dollars,
  }));

  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_INSTITUTES, taskDescription: "NIH award dollars by administering institute this cycle" },
    ctx
  );
  if (selections.length === 0) return null;

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const selected = selections.map((s) => ({ selection: s, candidate: byId.get(s.candidateId)! })).filter((x) => x.candidate);
  const leader = candidates.reduce((a, b) => (b.primaryMetric > a.primaryMetric ? b : a));
  const sortedSlices = [...selected].sort((a, b) => b.candidate.primaryMetric - a.candidate.primaryMetric);
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-nih-by-agency`,
    headline: `${leader.label} administers ${billionsOf(leader.primaryMetric)} (${((leader.primaryMetric / totalDollars) * 100).toFixed(0)}%) of the ${billionsOf(totalDollars)} NIH awarded between ${windowStart} and ${stamp}, the most of any of ${candidates.length} institutes and centers.`,
    questionId: "Q115",
    signalType: "structural-change",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: leader.primaryMetric, unit: "usd", comparedTo: `all NIH award dollars (${billionsOf(totalDollars)})`, deltaPercent: (leader.primaryMetric / totalDollars) * 100 },
    drivers: [
      {
        description: `Every award notice's dollars summed by its administering institute (NIH RePORTER's agency_ic_admin field): ${selected.map(({ selection, candidate }) => `${candidate.label}: ${candidate.summary}${source === "llm" ? ` — ${selection.rationale}` : ""}`).join("; ")}. Candidate selection method: ${source === "llm" ? `model-reasoned salience ranking over all ${candidates.length} institutes` : "deterministic top-N by dollar amount"}.`,
        supportingEvidenceIds: ["ev-nih-by-agency"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Which disease areas NIH is funding most heavily - cancer, infectious disease, heart and lung, aging - a leading indicator of where new therapies and the trials behind them will come from.",
    evidence: [
      {
        id: "ev-nih-by-agency",
        sourceId: NIH_SOURCE_ID,
        description: `NIH RePORTER projects/search, agency_ic_admin field, every award notice ${windowStart} to ${stamp} (${summary.notices.toLocaleString()} notices)`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Full-population totals across the window; a single two-year split is a baseline, not a trend.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "Grouped by the administering institute. Co-funded awards count fully toward the administering one.",
      `${summary.missingAmount.toLocaleString()} notices carry no award amount and count as $0.`,
      "Institute budgets are set by Congress, so shares move slowly; a large shift usually reflects appropriations, not research demand.",
    ],
    nextSignal: "Watch each institute's share across future pulls for a shift in where NIH funding concentrates.",
    recommendedInternalValidation: "Not applicable — this is public aggregate award data.",
    sourceIds: [NIH_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "donut",
      title: `NIH award dollars by administering institute, ${windowStart} to ${stamp}`,
      unit: "usd",
      slices: sortedSlices.map(({ candidate }) => ({ label: candidate.label, value: candidate.primaryMetric })),
    },
  };

  return validateInsight(insight);
}

async function buildTopRecipientOrgsSignal(
  awards: NihAward[],
  totalAvailable: number,
  pulledAt: string,
  windowStart: string,
  ctx: AgentContext
): Promise<Insight | null> {
  const stamp = pulledAt.slice(0, 10);
  const totals = new Map<string, number>();
  for (const a of awards) totals.set(a.organization, (totals.get(a.organization) ?? 0) + a.awardAmount);
  if (totals.size === 0) return null;

  const candidates: Candidate[] = Array.from(totals.entries()).map(([organization, dollars]) => ({
    id: organization,
    label: organization,
    summary: `$${dollars.toLocaleString()} total across sampled awards`,
    primaryMetric: dollars,
  }));

  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_ORGS, taskDescription: "NIH award dollars by recipient organization this cycle" },
    ctx
  );
  if (selections.length === 0) return null;

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const selected = selections.map((s) => ({ selection: s, candidate: byId.get(s.candidateId)! })).filter((x) => x.candidate);
  const leader = candidates.reduce((a, b) => (b.primaryMetric > a.primaryMetric ? b : a));
  const leaderAward = [...awards].filter((a) => a.organization === leader.label).sort((a, b) => b.awardAmount - a.awardAmount)[0];
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-nih-top-orgs`,
    headline: `${leader.label} leads sampled NIH award recipients with $${leader.primaryMetric.toLocaleString()} in total real award dollars between ${windowStart} and ${stamp}.`,
    questionId: "Q116",
    signalType: "structural-change",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: leader.primaryMetric, unit: "usd", comparedTo: `${candidates.length} distinct real recipient organizations in this sample` },
    drivers: [
      {
        description: `Real award dollars summed by recipient organization: ${selected.map(({ selection, candidate }) => `${candidate.label}: ${candidate.summary} — ${selection.rationale}`).join("; ")}. Candidate selection method: ${source === "llm" ? "model-reasoned salience ranking" : "deterministic top-N by dollar amount"}.`,
        supportingEvidenceIds: ["ev-nih-top-orgs"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "A real, sourced ranking of which universities/health systems are attracting the most NIH funding right now - the same kind of finding a real research-funding tracker publishes; legitimate to name real organizations here under this project's revised naming rule since it's computed directly from real data, not implied-proprietary.",
    evidence: [
      {
        id: "ev-nih-top-orgs",
        sourceId: NIH_SOURCE_ID,
        description: `NIH RePORTER projects/search, real \`organization.org_name\` field, award dollars summed across ${awards.length} sampled award notices, ${windowStart} to ${stamp}`,
        datasetVintage: stamp,
        url: leaderAward?.url,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each monthly pull recounts the trailing two-year window; a change counts as a trend only once it holds across consecutive pulls.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Covers only the ${awards.length} sampled awards (top by dollar amount) out of ${totalAvailable.toLocaleString()} total real award notices in this window - an organization with many small awards outside this sample would be undercounted here.`,
      "A real, sourced ranking computed from public NIH RePORTER data, not this project's own proprietary read on any institution's finances.",
      "Single snapshot — a baseline reading, not yet a trend across periods.",
    ],
    nextSignal: "Watch this organization ranking across a second real pull for the first genuine period-over-period shift in funding concentration.",
    recommendedInternalValidation: "Cross-check any organization of direct strategic relevance against NIH RePORTER's own public site before treating this ranking as fully assessed.",
    sourceIds: [NIH_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Top recipient organizations by sampled NIH award dollars, ${windowStart} to ${stamp}`,
      unit: "usd",
      bars: selected.map(({ candidate }) => ({ label: candidate.label, value: candidate.primaryMetric })),
    },
  };

  return validateInsight(insight);
}

/**
 * Real per-project keyword-tag frequency across the sampled NIH awards -
 * added 2026-09-24 per Adam's request for "themes and trends in funding
 * going toward specific areas of research." Real, verified finding from
 * the initial 2026-09-24 pull (150-day window, before the same-day
 * window widening below): raw term frequency is dominated by generic
 * grant-administration boilerplate ("Research" in 85/100 awards, "Goals"
 * in 74/100, "Data" in 62/100, etc.) - present in nearly every award
 * regardless of topic, so excluded here as not a specific theme
 * (GENERIC_TERM_MAX_FRACTION). Within the remaining band, that initial
 * pull showed a real, genuine concentration in Alzheimer's Disease and
 * Related Dementias (ADRD) terminology, expressed across many
 * near-synonymous real NIH-generated phrasings (e.g. "AD risk",
 * "Alzheimer risk", "Alzheimer's disease risk" each counted separately -
 * not merged, see this insight's own limitations for why). The specific
 * leading term shifts pull-to-pull as the real top-100-by-dollar sample
 * changes (expected, not a bug) - this is a dynamically computed real
 * result, not a hardcoded finding.
 */
function buildResearchThemesSignal(awards: NihAward[], pulledAt: string, windowStart: string): Insight | null {
  const stamp = pulledAt.slice(0, 10);
  const sampleSize = awards.length;
  const maxGenericCount = Math.ceil(sampleSize * GENERIC_TERM_MAX_FRACTION);

  const awardCountByTerm = new Map<string, number>();
  for (const award of awards) {
    for (const term of new Set(award.terms)) {
      awardCountByTerm.set(term, (awardCountByTerm.get(term) ?? 0) + 1);
    }
  }

  const inBand = Array.from(awardCountByTerm.entries())
    .filter(([, count]) => count >= MIN_TERM_AWARD_COUNT && count <= maxGenericCount)
    .sort((a, b) => b[1] - a[1]);
  if (inBand.length === 0) return null;

  const top = inBand.slice(0, TOP_N_THEMES);
  const leader = top[0];
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-nih-research-themes`,
    headline: `Among the ${sampleSize} sampled NIH awards, "${leader[0]}" is the most common non-generic research term, appearing in ${leader[1]} of ${sampleSize} awards (${((leader[1] / sampleSize) * 100).toFixed(0)}%).`,
    questionId: "Q129",
    signalType: "baseline",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: leader[1], unit: "awards", comparedTo: `${sampleSize} sampled awards` },
    drivers: [
      {
        description: `Real per-award keyword-tag presence (NIH RePORTER's own \`terms\` field), counted once per award regardless of repetition within it, excluding terms present in more than ${(GENERIC_TERM_MAX_FRACTION * 100).toFixed(0)}% of the sample (generic grant-administration language, e.g. "Research", "Data", "Development") and terms present in fewer than ${MIN_TERM_AWARD_COUNT} awards (too rare to be a theme): ${top.map(([term, count]) => `"${term}" (${count})`).join(", ")}.`,
        supportingEvidenceIds: ["ev-nih-themes"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Where NIH-funded research attention is concentrating within this sample - distinct from the dollar, organization and institute rankings, this shows *what* the funded research is actually about, which is the signal a payer executive tracking pipeline/research trends would want.",
    evidence: [
      {
        id: "ev-nih-themes",
        sourceId: NIH_SOURCE_ID,
        description: `NIH RePORTER projects/search, real \`terms\` field across ${sampleSize} sampled awards, ${windowStart} to ${stamp}`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each monthly pull recounts the trailing two-year window; a theme counts as a trend only once it holds across consecutive pulls.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "NIH RePORTER's real `terms` field is a keyword-tagging system that generates many near-synonymous phrasings for the same underlying real concept (e.g. \"AD risk\", \"Alzheimer risk\", and \"Alzheimer's disease risk\" all appear as separate entries below when present) - this insight does NOT merge synonyms, so a single real research theme may appear as several adjacent, similar-looking entries rather than one combined count. Read the list as raw real keyword tags, not a finalized topic taxonomy.",
      `Covers only the ${sampleSize} sampled awards (the largest by dollar amount), not every award for this window - a theme common among smaller awards outside this sample would not appear here.`,
      `The ${(GENERIC_TERM_MAX_FRACTION * 100).toFixed(0)}%-of-sample generic-term cutoff is a disclosed, documented statistical rule (excludes administrative boilerplate like "Research" or "Data"), not a hand-picked stoplist of specific words.`,
      "A term's presence describes what the award's own real record was tagged with, not this project's independent judgment about the research's actual scientific content.",
    ],
    nextSignal: "Watch whether this same theme leads again across a second real pull, which would be the first genuine persistence signal for a funding-theme concentration.",
    recommendedInternalValidation: "Not applicable - this is public aggregate award-tagging data.",
    sourceIds: [NIH_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Most common non-generic research terms, sampled NIH awards (${windowStart} to ${stamp})`,
      unit: "awards",
      bars: top.map(([term, count]) => ({ label: term, value: count })),
    },
  };

  return validateInsight(insight);
}

// ---------------------------------------------------------------------------
// openFDA drug approvals (Q117-Q119)
// ---------------------------------------------------------------------------

function buildNmeApprovalCountSignal(approvals: FdaApproval[], pulledAt: string, windowStart: string): Insight | null {
  const stamp = pulledAt.slice(0, 10);
  const sorted = [...approvals].sort((a, b) => (a.submissionStatusDate < b.submissionStatusDate ? 1 : -1));
  const mostRecent = sorted[0];
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-fda-nme-count`,
    headline: `openFDA recorded ${approvals.length} new molecular entity (Type 1) approval${approvals.length === 1 ? "" : "s"} between ${windowStart} and ${stamp}; most recently ${mostRecent.brandName} (${mostRecent.activeIngredient}), sponsor ${mostRecent.sponsorName}, approved ${mostRecent.submissionStatusDate} under ${mostRecent.reviewPriority} review.`,
    questionId: "Q117",
    signalType: "policy",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: approvals.length, unit: "count", comparedTo: `most recent: ${mostRecent.brandName} (${mostRecent.submissionStatusDate})` },
    drivers: [
      {
        description: `Real openFDA drugsfda approvals, real \`submission_class_code\` containing "TYPE 1" and \`submission_status\` "AP", most recent first: ${sorted
          .slice(0, 6)
          .map((a) => `${a.brandName} (${a.activeIngredient}, sponsor ${a.sponsorName}, ${a.reviewPriority} review, approved ${a.submissionStatusDate})`)
          .join("; ")}.`,
        supportingEvidenceIds: ["ev-fda-nme-count"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "A real, regulatory-approval-based catalyst signal - a new molecular entity approval marks the start of a real commercial product's market entry, directly relevant to a payer's formulary/utilization-management planning horizon.",
    evidence: [
      {
        id: "ev-fda-nme-count",
        sourceId: FDA_SOURCE_ID,
        description: `openFDA drugsfda, ${approvals.length} real Type 1 (new molecular entity) approvals with submission_status AP, ${windowStart} to ${stamp}`,
        datasetVintage: stamp,
        url: mostRecent.url,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each monthly pull recounts the trailing two-year window; a change counts as a trend only once it holds across consecutive pulls.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "Never uses the term \"breakthrough\" — openFDA's drugsfda dataset has no such field. Only the real `submission_class_code` (e.g. \"TYPE 1\") and `review_priority` (e.g. \"PRIORITY\" vs. \"STANDARD\") fields are used verbatim.",
      "openFDA's search matches at the application level, not the submission level — this adapter re-filters to only the specific real submission(s) whose own status date falls in this window and whose class code/status actually match, per this agent's data adapter header.",
      "Bounded to a single 1000-application API request per pull (a real, disclosed cap, raised 2026-09-24 alongside the window widening to 730 days - verified live to comfortably cover the real matching population) — if a real window ever exceeds 1000 matching applications, this insight would undercount rather than silently paginate.",
      "An approval record only, never a claim about the drug's eventual clinical or commercial success.",
    ],
    nextSignal: "Watch this approval count across a second real pull for the first genuine period-over-period shift in NME approval activity.",
    recommendedInternalValidation: "Cross-check any approval of direct strategic relevance against the FDA's own Drugs@FDA record before treating it as fully assessed.",
    sourceIds: [FDA_SOURCE_ID],
    generatingAgent: AGENT_ID,
  };

  return validateInsight(insight);
}

function buildReviewPrioritySplitSignal(approvals: FdaApproval[], pulledAt: string, windowStart: string): Insight | null {
  const stamp = pulledAt.slice(0, 10);
  const priority = approvals.filter((a) => a.reviewPriority === "PRIORITY").length;
  const standard = approvals.length - priority;
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-fda-priority-split`,
    headline: `${((priority / approvals.length) * 100).toFixed(0)}% of the ${approvals.length} new molecular entity approvals between ${windowStart} and ${stamp} (${priority} of ${approvals.length}) received PRIORITY review; the remainder were STANDARD.`,
    questionId: "Q118",
    signalType: "policy",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: (priority / approvals.length) * 100, unit: "percent", comparedTo: `${approvals.length} total real approvals` },
    drivers: [
      {
        description: `Real openFDA \`review_priority\` field split across ${approvals.length} approvals: ${priority} PRIORITY, ${standard} STANDARD.`,
        supportingEvidenceIds: ["ev-fda-priority-split"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "A PRIORITY-review designation is a real, FDA-stated signal that a drug may offer a significant improvement over available therapies - directly relevant to how soon a payer should expect formulary/utilization-management decisions to matter for a given approval.",
    evidence: [
      {
        id: "ev-fda-priority-split",
        sourceId: FDA_SOURCE_ID,
        description: `openFDA drugsfda, real \`review_priority\` field across ${approvals.length} Type 1 approvals, ${windowStart} to ${stamp}`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each monthly pull recounts the trailing two-year window; a change counts as a trend only once it holds across consecutive pulls.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "PRIORITY review reflects FDA's own review-timeline designation, not a clinical-efficacy or safety judgment about the drug.",
      `Small real sample (${approvals.length} approvals this window) — a single approval or two can swing this percentage meaningfully.`,
      "Single snapshot — a baseline reading, not yet a trend across periods.",
    ],
    nextSignal: "Watch this priority/standard split across a second real pull for a genuine period-over-period shift.",
    recommendedInternalValidation: "Not applicable — this is public FDA regulatory data.",
    sourceIds: [FDA_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "donut",
      title: `Review priority split, new molecular entity approvals, ${windowStart} to ${stamp}`,
      unit: "approvals",
      slices: [
        { label: "PRIORITY", value: priority },
        { label: "STANDARD", value: standard },
      ],
    },
  };

  return validateInsight(insight);
}

function buildApprovalsByMonthSignal(approvals: FdaApproval[], pulledAt: string, windowStart: string): Insight | null {
  const stamp = pulledAt.slice(0, 10);
  const byMonth = new Map<string, number>();
  for (const a of approvals) byMonth.set(monthKey(a.submissionStatusDate), (byMonth.get(monthKey(a.submissionStatusDate)) ?? 0) + 1);
  const monthBars = Array.from(byMonth.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (monthBars.length === 0) return null;
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-fda-by-month`,
    headline: `New molecular entity approvals were spread across ${monthBars.length} month(s) between ${windowStart} and ${stamp}, ranging from ${Math.min(...monthBars.map(([, v]) => v))} to ${Math.max(...monthBars.map(([, v]) => v))} approvals per month.`,
    questionId: "Q119",
    signalType: "policy",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: Math.max(...monthBars.map(([, v]) => v)), unit: "approvals/month", comparedTo: `${monthBars.length} months in window` },
    drivers: [
      {
        description: `Real openFDA approval counts by month: ${monthBars.map(([m, v]) => `${m}: ${v}`).join("; ")}.`,
        supportingEvidenceIds: ["ev-fda-by-month"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "A real month-over-month cadence read on new molecular entity approval activity — the same shape as this dashboard's CMS-rules-finalized-per-month chart, applied to the FDA approval pipeline instead.",
    evidence: [
      {
        id: "ev-fda-by-month",
        sourceId: FDA_SOURCE_ID,
        description: `openFDA drugsfda, ${approvals.length} real Type 1 approvals grouped by real submission_status_date month, ${windowStart} to ${stamp}`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each monthly pull recounts the trailing two-year window; a change counts as a trend only once it holds across consecutive pulls.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Small real monthly counts (${approvals.length} approvals total across ${monthBars.length} months) — month-to-month variation here is not yet statistically meaningful.`,
      "Single snapshot — a baseline reading, not yet a multi-cycle trend.",
    ],
    nextSignal: "Watch this monthly cadence across a second real pull for the first genuine multi-period pattern.",
    recommendedInternalValidation: "Not applicable — this is public FDA regulatory data.",
    sourceIds: [FDA_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: "New molecular entity approvals per month (trailing window)",
      unit: "approvals",
      bars: monthBars.map(([label, value]) => ({ label, value })),
    },
  };

  return validateInsight(insight);
}

// ---------------------------------------------------------------------------
// SEC EDGAR 8-K filings (Q120-Q122)
// ---------------------------------------------------------------------------

async function buildItemCountByCompanySignal(
  filings: SecFiling[],
  pulledAt: string,
  windowStart: string,
  itemCode: string,
  itemDescription: string,
  questionId: string,
  idSuffix: string,
  ctx: AgentContext
): Promise<Insight | null> {
  const stamp = pulledAt.slice(0, 10);

  const candidates: Candidate[] = TRACKED_COMPANIES.map((company) => {
    const matching = filings.filter((f) => f.cik === company.cik && f.items.includes(itemCode));
    return {
      id: company.cik,
      label: company.name,
      summary: `${matching.length} Item ${itemCode} filing(s) in the trailing window`,
      primaryMetric: matching.length,
    };
  });

  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TRACKED_COMPANIES.length, taskDescription: `Item ${itemCode} 8-K filing count by tracked health insurer this cycle` },
    ctx
  );
  if (selections.length === 0) return null;

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const selected = selections.map((s) => ({ selection: s, candidate: byId.get(s.candidateId)! })).filter((x) => x.candidate);
  const filed = candidates.filter((c) => c.primaryMetric > 0);
  const none = candidates.filter((c) => c.primaryMetric === 0);
  const totalFilings = candidates.reduce((s, c) => s + c.primaryMetric, 0);
  const confidence = baselineConfidence();

  const repFiling = [...filings]
    .filter((f) => f.items.includes(itemCode))
    .sort((a, b) => (a.filingDate < b.filingDate ? 1 : -1))[0];

  const headline =
    filed.length === 0
      ? `None of the ${TRACKED_COMPANIES.length} tracked health insurers filed an Item ${itemCode} (${itemDescription}) 8-K in the trailing window.`
      : `Of the ${TRACKED_COMPANIES.length} tracked health insurers, ${filed.map((c) => c.label).join(", ")} filed at least one Item ${itemCode} (${itemDescription}) 8-K in the trailing window (${totalFilings} filing${totalFilings === 1 ? "" : "s"} total)${none.length > 0 ? `; ${none.map((c) => c.label).join(", ")} filed none` : ""}.`;

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-sec-${idSuffix}-by-company`,
    headline,
    questionId,
    signalType: "structural-change",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: totalFilings, unit: "count", comparedTo: `${TRACKED_COMPANIES.length} tracked companies` },
    drivers: [
      {
        description: `Real per-company Item ${itemCode} 8-K filing counts: ${selected.map(({ selection, candidate }) => `${candidate.label}: ${candidate.summary} — ${selection.rationale}`).join("; ")}. Candidate selection method: ${source === "llm" ? "model-reasoned salience ranking" : "deterministic ranking (all real candidates included)"}.`,
        supportingEvidenceIds: [`ev-sec-${idSuffix}-by-company`],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      itemCode === "5.02"
        ? "Item 5.02 filing activity is a real, disclosed leadership-change signal (departure OR appointment of an officer/director) at a tracked competitor — directly relevant to competitive/talent-market awareness, never itself a claim about why the change happened."
        : "Item 1.01 filing activity is a real, disclosed material-agreement signal (which covers far more than partnerships — credit facilities, leases, and other material contracts) at a tracked competitor — worth monitoring even though the agreement's specific content isn't captured by this structured field alone.",
    evidence: [
      {
        id: `ev-sec-${idSuffix}-by-company`,
        sourceId: SEC_SOURCE_ID,
        description: `SEC EDGAR submissions API, real Item ${itemCode} 8-K filing counts across the ${TRACKED_COMPANIES.length}-company watchlist, ${windowStart} to ${stamp}`,
        datasetVintage: stamp,
        url: repFiling?.url,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each monthly pull recounts the trailing two-year window; a change counts as a trend only once it holds across consecutive pulls.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Bounded to a fixed ${TRACKED_COMPANIES.length}-company watchlist (${TRACKED_COMPANIES.map((c) => c.name).join(", ")}) — not the full health-insurance sector or every publicly traded healthcare company.`,
      itemCode === "5.02"
        ? "Item 5.02 covers BOTH departure AND appointment of officers/directors — this insight never characterizes a filing as a firing or a resignation, only as \"departure or election of directors/principal officers,\" the real SEC item description."
        : "Item 1.01 is \"entry into a material definitive agreement\" and covers far more than partnerships (credit facilities, leases, and other material contracts) — this insight never characterizes a filing as \"a partnership\" without confirming the agreement's actual content.",
      "A filing count is a real disclosure-activity signal, not a materiality or business-impact judgment about what was filed.",
    ],
    nextSignal: `Watch this per-company Item ${itemCode} filing count across a second real pull for a genuine period-over-period shift.`,
    recommendedInternalValidation: "Read the actual filing text at the linked SEC URL before drawing any conclusion beyond \"a filing of this type occurred.\"",
    sourceIds: [SEC_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Item ${itemCode} 8-K filings by tracked health insurer (trailing window)`,
      unit: "filings",
      bars: selected.map(({ candidate }) => ({ label: candidate.label, value: candidate.primaryMetric })),
    },
  };

  return validateInsight(insight);
}

async function buildLeadershipChangeByCompanySignal(filings: SecFiling[], pulledAt: string, windowStart: string, ctx: AgentContext): Promise<Insight | null> {
  return buildItemCountByCompanySignal(
    filings,
    pulledAt,
    windowStart,
    "5.02",
    "departure or election of directors/principal officers",
    "Q120",
    "leadership-change",
    ctx
  );
}

async function buildMaterialAgreementByCompanySignal(filings: SecFiling[], pulledAt: string, windowStart: string, ctx: AgentContext): Promise<Insight | null> {
  return buildItemCountByCompanySignal(
    filings,
    pulledAt,
    windowStart,
    "1.01",
    "entry into a material definitive agreement",
    "Q122",
    "material-agreement",
    ctx
  );
}

function buildFilingTypeMixSignal(filings: SecFiling[], pulledAt: string, windowStart: string): Insight | null {
  const stamp = pulledAt.slice(0, 10);
  const NAMED_ITEMS = [
    { code: "5.02", label: "Item 5.02 (departure/election of directors or principal officers)" },
    { code: "1.01", label: "Item 1.01 (material definitive agreement)" },
    { code: "2.02", label: "Item 2.02 (results of operations and financial condition)" },
  ];

  let namedTotal = 0;
  const namedCounts = NAMED_ITEMS.map(({ code, label }) => {
    const count = filings.reduce((s, f) => s + (f.items.includes(code) ? 1 : 0), 0);
    namedTotal += count;
    return { label, count };
  });
  const totalItemOccurrences = filings.reduce((s, f) => s + f.items.length, 0);
  const otherCount = totalItemOccurrences - namedTotal;
  if (totalItemOccurrences === 0) return null;
  const confidence = baselineConfidence();

  const pctOf = (n: number) => ((n / totalItemOccurrences) * 100).toFixed(0);

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-sec-filing-mix`,
    headline: `Across the ${TRACKED_COMPANIES.length}-company watchlist, ${totalItemOccurrences} total 8-K item codes were filed between ${windowStart} and ${stamp}: Item 5.02 accounted for ${pctOf(namedCounts[0].count)}%, Item 1.01 for ${pctOf(namedCounts[1].count)}%, Item 2.02 for ${pctOf(namedCounts[2].count)}%, and all other item codes for ${pctOf(otherCount)}%.`,
    questionId: "Q121",
    signalType: "structural-change",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: totalItemOccurrences, unit: "count", comparedTo: `${filings.length} total real 8-K filings across the watchlist` },
    drivers: [
      {
        description: `Real 8-K item-code occurrences across the whole watchlist: ${namedCounts.map((c) => `${c.label}: ${c.count}`).join("; ")}; all other item codes combined: ${otherCount}.`,
        supportingEvidenceIds: ["ev-sec-filing-mix"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "An industry-wide 'what kind of activity is happening' read across the whole tracked watchlist at once - distinct from the per-company findings, which show who is filing, not what kind of activity dominates market-wide.",
    evidence: [
      {
        id: "ev-sec-filing-mix",
        sourceId: SEC_SOURCE_ID,
        description: `SEC EDGAR submissions API, real 8-K item-code occurrences across the ${TRACKED_COMPANIES.length}-company watchlist, ${windowStart} to ${stamp}`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each monthly pull recounts the trailing two-year window; a change counts as a trend only once it holds across consecutive pulls.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Bounded to a fixed ${TRACKED_COMPANIES.length}-company watchlist — not the full health-insurance sector.`,
      "A single 8-K filing can carry more than one item code, so these are item-code occurrences, not filing counts — the two totals are not the same and must not be conflated.",
      "Item 5.02 covers both departure and appointment of officers/directors; Item 1.01 covers far more than partnerships (credit facilities, leases, and other material contracts) — never characterized beyond the real item description.",
    ],
    nextSignal: "Watch this item-code mix across a second real pull for a genuine shift in the kind of disclosure activity dominating the watchlist.",
    recommendedInternalValidation: "Read the actual filing text before drawing any conclusion beyond \"a filing of this item type occurred.\"",
    sourceIds: [SEC_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "donut",
      title: `8-K item-code mix across the tracked watchlist, ${windowStart} to ${stamp}`,
      unit: "item occurrences",
      slices: [
        ...namedCounts.sort((a, b) => b.count - a.count).map((c) => ({ label: c.label, value: c.count })),
        { label: "Other item codes", value: otherCount },
      ],
    },
  };

  return validateInsight(insight);
}

// ---------------------------------------------------------------------------
// ClinicalTrials.gov (Q123-Q124)
// ---------------------------------------------------------------------------

function buildTrialResultsCountSignal(trials: ClinicalTrialResult[], pulledAt: string, windowStart: string): Insight | null {
  const stamp = pulledAt.slice(0, 10);
  const sorted = [...trials].sort((a, b) => (a.resultsFirstPostDate < b.resultsFirstPostDate ? 1 : -1));
  const mostRecent = sorted[0];
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-ct-results-count`,
    headline: `${trials.length} industry-sponsored Phase 3 trials had results newly posted to ClinicalTrials.gov between ${windowStart} and ${stamp}; most recently ${mostRecent.leadSponsorName}'s "${mostRecent.briefTitle}" (${mostRecent.enrollmentCount.toLocaleString()} enrolled), posted ${mostRecent.resultsFirstPostDate}.`,
    questionId: "Q123",
    signalType: "baseline",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: trials.length, unit: "count", comparedTo: `most recent: ${mostRecent.resultsFirstPostDate}` },
    drivers: [
      {
        description: `Real ClinicalTrials.gov results postings, industry-sponsored Phase 3 trials only, most recent first: ${sorted
          .slice(0, 6)
          .map((t) => `${t.leadSponsorName} — "${t.briefTitle}" (${t.enrollmentCount.toLocaleString()} enrolled, posted ${t.resultsFirstPostDate})`)
          .join("; ")}.`,
        supportingEvidenceIds: ["ev-ct-results-count"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "A real posted-results event is a concrete, dated catalyst for a payer's clinical/formulary-planning watchlist - it marks that a real Phase 3 program has reached a reportable milestone, independent of what the results actually show.",
    evidence: [
      {
        id: "ev-ct-results-count",
        sourceId: CT_SOURCE_ID,
        description: `ClinicalTrials.gov v2 studies API, ${trials.length} real industry-sponsored Phase 3 trials with results first posted, ${windowStart} to ${stamp}`,
        datasetVintage: stamp,
        url: mostRecent.url,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each monthly pull recounts the trailing two-year window; a change counts as a trend only once it holds across consecutive pulls.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "A results posting encodes NO success/failure judgment — this insight never says \"positive result,\" only that results were posted, by whom, with what real enrollment number.",
      "Bounded to industry-sponsored trials only (leadSponsorClass = INDUSTRY) — academic and other-government-sponsored Phase 3 results in the same window are excluded by design, see this agent's data adapter.",
      "Bounded to a real, disclosed 10-page pagination cap (up to 10,000 raw studies) per pull, raised from a single 100-record page on 2026-09-24 when the real window widened to 2 years — see this agent's data adapter.",
    ],
    nextSignal: "Watch this results-posting count across a second real pull for a genuine period-over-period shift in industry Phase 3 reporting activity.",
    recommendedInternalValidation: "Read the actual posted results at the linked ClinicalTrials.gov study page before drawing any conclusion about outcome.",
    sourceIds: [CT_SOURCE_ID],
    generatingAgent: AGENT_ID,
  };

  return validateInsight(insight);
}

function buildEnrollmentDistributionSignal(trials: ClinicalTrialResult[], pulledAt: string, windowStart: string): Insight | null {
  const stamp = pulledAt.slice(0, 10);
  const enrollments = trials.map((t) => t.enrollmentCount).filter((n) => Number.isFinite(n) && n > 0);
  if (enrollments.length < MIN_TRIALS_FOR_BOXPLOT) return null;

  const box = tukeyBox(enrollments);
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-ct-enrollment-distribution`,
    headline: `Enrollment across the ${box.sampleSize} industry-sponsored Phase 3 trials with results posted between ${windowStart} and ${stamp} has a median of ${box.median.toLocaleString()} participants (IQR ${box.q1.toLocaleString()}–${box.q3.toLocaleString()}).`,
    questionId: "Q124",
    signalType: "baseline",
    period: { start: windowStart, end: stamp },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: box.median, unit: "participants", comparedTo: `IQR ${box.q1.toLocaleString()}-${box.q3.toLocaleString()}` },
    drivers: [
      {
        description: `Real per-trial enrollment counts across ${box.sampleSize} industry-sponsored Phase 3 trials: median ${box.median.toLocaleString()}, IQR ${box.q1.toLocaleString()}-${box.q3.toLocaleString()}, whiskers ${box.whiskerLow.toLocaleString()}-${box.whiskerHigh.toLocaleString()}, ${box.outliers.length} real outlier(s) beyond the Tukey whiskers.`,
        supportingEvidenceIds: ["ev-ct-enrollment-distribution"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Trial scale (enrollment) is a proxy for a program's evidentiary weight and eventual real-world population relevance - a useful read alongside the results-posting count for prioritizing which newly reported trials merit closer clinical/formulary review.",
    evidence: [
      {
        id: "ev-ct-enrollment-distribution",
        sourceId: CT_SOURCE_ID,
        description: `ClinicalTrials.gov v2 studies API, real \`enrollmentInfo.count\` field across ${box.sampleSize} industry-sponsored Phase 3 trials, ${windowStart} to ${stamp}`,
        datasetVintage: stamp,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each monthly pull recounts the trailing two-year window; a change counts as a trend only once it holds across consecutive pulls.`,
    freshness: { dataAsOf: stamp, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "Enrollment size is a real proxy for trial scale, not a measure of clinical significance or result direction.",
      "Bounded to industry-sponsored trials only, and to a real, disclosed 10-page pagination cap per pull — see this agent's data adapter.",
      `Only built when at least ${MIN_TRIALS_FOR_BOXPLOT} real trials are available in the sample (this cycle: ${box.sampleSize}) — a real size-gating rule, same pattern as this dashboard's other boxplot insights.`,
    ],
    nextSignal: "Watch this enrollment distribution across a second real pull for a genuine shift in typical Phase 3 trial scale.",
    recommendedInternalValidation: "Not applicable — this is public trial-registry data.",
    sourceIds: [CT_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "boxplot",
      title: `Enrollment distribution, industry-sponsored Phase 3 trials with newly posted results, ${windowStart} to ${stamp}`,
      unit: "participants",
      boxes: [{ label: "All sampled trials", ...box }],
    },
  };

  return validateInsight(insight);
}
