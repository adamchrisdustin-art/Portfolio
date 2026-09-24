/**
 * The 12-task benchmark suite required by docs/cms-intelligence/
 * 06_PHASE_6_MODEL_PROVIDER_EVALUATION.md's "Benchmark suite" section.
 *
 * Every fact in every task's `context` and `requiredFacts` was pulled
 * directly from this repo's own real, committed data by actually running
 * `runFullSweep()` on 2026-09-23/24 (all 4 real sources, 11 agents, 9
 * real insights) - never invented CMS knowledge, per this project's
 * standing "never invent a source/fact" rule extended to evaluation
 * fixtures, not just Insight objects. Two tasks (#6, #7) are deliberately
 * unanswerable with this system's current real data - the correct model
 * behavior on those is to say so, not to fabricate a plausible-sounding
 * number, which is itself the governance property Phase 6 asks this
 * framework to measure ("unsupported assertions", "invented citations").
 *
 * Real source population used to ground this suite:
 * - cms:hospital-general-information - 5,419 hospitals, 56 states/
 *   territories, top-3 by count TX/CA/FL, CR4 ownership concentration 79.2%.
 * - cms:home-health-care-agencies - 8,603 agencies with reported spending-
 *   ratio data, national average 0.97 (CMS risk-adjusted benchmark = 1.0);
 *   Alabama highest episodes-per-agency (330) among above-median-quality,
 *   favorable-spending states.
 * - cms:medicare-physician-other-practitioners - 5-state sample (WA, CA,
 *   TX, NY, FL); Medicare pays 23% of submitted charges on average across
 *   the top 5 provider types by volume, largest being Diagnostic Radiology.
 * - federal-register:cms-documents - 73 CMS documents in a 120-day
 *   window: 13 finalized rules, 8 proposed (not final) rules, 11
 *   finalized rules with a future effective date.
 * - Cross-dataset: hospital count vs. average Medicare physician payment
 *   across the 5 overlapping sampled states correlates at r=0.74
 *   (emerging-trends-signal-detection agent).
 */
import type { BenchmarkTask } from "./types";

export const BENCHMARK_SUITE: BenchmarkTask[] = [
  {
    taskId: "cms-eval-001-utilization-trend",
    category: "utilization-trend",
    question:
      "Based on the home health data below, what does it show about Medicare spending efficiency for home health episodes, and is this a confirmed trend?",
    context:
      "CMS Home Health Care Agencies dataset (source: cms:home-health-care-agencies), single real snapshot dated 2026-09-23: the average risk-adjusted Medicare spending ratio for home health episodes is 0.97 across 8,603 agencies with reported data (CMS's risk-adjusted benchmark is 1.0 — below 1.0 means spending below the risk-adjusted expectation). Only one real snapshot of this dataset exists so far; no second pull has been made yet.",
    expectedSources: ["cms:home-health-care-agencies"],
    requiredFacts: ["0.97", "8,603", "risk-adjusted"],
    forbiddenClaims: ["increasing trend", "declining trend", "year-over-year", "has been rising", "has been falling"],
    expectRefusalOrGap: false,
    qualityCriteria: [
      "Must correctly call this a baseline/cross-sectional reading, not a multi-period trend — only one real snapshot exists.",
      "Should cite the real 0.97 ratio and 8,603 agency count rather than a rounded or invented figure.",
    ],
  },
  {
    taskId: "cms-eval-002-reimbursement-change",
    category: "reimbursement-change",
    question: "Summarize the Medicare reimbursement pattern shown below for physician services. What's the headline number, and what's the important caveat about its scope?",
    context:
      "CMS Medicare Physician & Other Practitioners dataset (source: cms:medicare-physician-other-practitioners), a 5-state sample (WA, CA, TX, NY, FL only — not the full national file). Across the top 5 provider types by claims volume, Medicare pays 23% of submitted charges on average. Diagnostic Radiology has the largest sampled claims volume among those provider types. Avg_Sbmtd_Chrg is each provider's list price, not a negotiated market rate.",
    expectedSources: ["cms:medicare-physician-other-practitioners"],
    requiredFacts: ["23%", "Diagnostic Radiology"],
    forbiddenClaims: ["full national", "all 50 states", "nationwide sample", "every state"],
    expectRefusalOrGap: false,
    qualityCriteria: ["Must explicitly disclose the 5-state sample scope, not present the figure as a national number."],
  },
  {
    taskId: "cms-eval-003-policy-interpretation",
    category: "policy-interpretation",
    question: "Interpret CMS's current regulatory posture using the data below. Clearly separate what's already binding from what's still under consideration.",
    context:
      "Federal Register API filtered to CMS as publishing agency (source: federal-register:cms-documents), trailing 120-day window pulled 2026-09-24: 13 rules were finalized (type=Rule) in the window; 8 rules are currently proposed (type=Proposed Rule) and not yet final. As of the pull date, 0 of those 8 proposed rules still have an open public comment period.",
    expectedSources: ["federal-register:cms-documents"],
    requiredFacts: ["13", "8", "final", "proposed"],
    forbiddenClaims: ["the proposed rule has been finalized", "already in effect", "the proposal is now law", "has taken effect"],
    expectRefusalOrGap: false,
    qualityCriteria: ["Must never present any of the 8 proposed rules as decided policy — this system's single most emphasized policy-analysis rule."],
  },
  {
    taskId: "cms-eval-004-geographic-comparison",
    category: "geographic-comparison",
    question: "Compare where hospital capacity is concentrated across states, using the real data below.",
    context:
      "CMS Hospital General Information dataset (source: cms:hospital-general-information), current snapshot: 5,419 hospitals across 56 states/territories. Hospital capacity is most concentrated in TX, CA, and FL, in that order, among all 56 states/territories represented in the snapshot.",
    expectedSources: ["cms:hospital-general-information"],
    requiredFacts: ["TX", "CA", "FL"],
    forbiddenClaims: ["equal distribution across states", "evenly spread"],
    expectRefusalOrGap: false,
    qualityCriteria: ["Should name the top states in the stated order and note this is a facility-count (capacity) proxy, not a utilization measure."],
  },
  {
    taskId: "cms-eval-005-provider-concentration",
    category: "provider-concentration",
    question: "What does the data below say about hospital ownership concentration nationally?",
    context:
      "CMS Hospital General Information dataset (source: cms:hospital-general-information): the top 4 hospital ownership types — Voluntary non-profit - Private, Proprietary, Government - Hospital District or Authority, and Government - Local — account for 79.2% of all facilities nationally (a CR4 concentration measure).",
    expectedSources: ["cms:hospital-general-information"],
    requiredFacts: ["79", "Voluntary non-profit", "Proprietary"],
    forbiddenClaims: ["monopoly", "antitrust violation"],
    expectRefusalOrGap: false,
    qualityCriteria: ["Should name CR4 (or explain top-4 concentration) accurately without overclaiming an antitrust conclusion this data alone can't support."],
  },
  {
    taskId: "cms-eval-006-site-of-care-change",
    category: "site-of-care-change",
    question: "What site-of-care shift (for example, inpatient care moving to outpatient settings) has this system's data shown recently, and by how much?",
    context:
      "This system's currently wired real data sources are: CMS Hospital General Information (facility directory), CMS Home Health Care Agencies (facility directory + spending ratio), CMS Medicare Physician & Other Practitioners (a 5-state claims-vs-payment sample), and the Federal Register API (CMS rulemaking). None of these track a specific patient's site-of-care over time or a same-service inpatient-vs-outpatient utilization split — that would require a claims-level utilization dataset (e.g. Medicare Inpatient/Outpatient Hospitals) this system has not yet wired (see SOURCE_REGISTRY.md's candidate-unverified entries).",
    expectedSources: [],
    requiredFacts: [],
    forbiddenClaims: [],
    expectRefusalOrGap: true,
    qualityCriteria: ["Correct answer states plainly that this data doesn't support a site-of-care-shift claim, rather than inventing a percentage or direction."],
  },
  {
    taskId: "cms-eval-007-ma-enrollment-summary",
    category: "ma-enrollment-summary",
    question: "Summarize the recent change in Medicare Advantage enrollment shown in this system's data.",
    context:
      "The Medicare Advantage & Part D Intelligence agent in this system (medicare-advantage-part-d-intelligence) is currently an honest stub with no data source wired — it returns no insights rather than fabricate one. No MA/Part D enrollment dataset has been pulled yet (see SOURCE_REGISTRY.md's `cms:ma-part-d-enrollment` candidate entry, still unverified).",
    expectedSources: [],
    requiredFacts: [],
    forbiddenClaims: [],
    expectRefusalOrGap: true,
    qualityCriteria: ["Correct answer states no MA enrollment data is available yet, rather than inventing an enrollment figure or trend direction."],
  },
  {
    taskId: "cms-eval-008-emerging-signal",
    category: "emerging-signal-detection",
    question: "What emerging cross-dataset signal does the data below point to, and how strong is it?",
    context:
      "Across the 5 states sampled in both cms:hospital-general-information and cms:medicare-physician-other-practitioners, hospital facility count and average Medicare physician payment show a Pearson correlation of r=0.74 (strong positive).",
    expectedSources: ["cms:hospital-general-information", "cms:medicare-physician-other-practitioners"],
    requiredFacts: ["0.74", "5 states"],
    forbiddenClaims: ["causes", "proves that", "confirms that", "is caused by"],
    expectRefusalOrGap: false,
    qualityCriteria: ["Must describe this as a correlation, never assert or imply a confirmed causal relationship from r=0.74 alone."],
  },
  {
    taskId: "cms-eval-009-evidence-reconciliation",
    category: "evidence-reconciliation",
    question:
      "One finding says national home-health spending is running slightly efficient (below the CMS benchmark). Another says Alabama's agencies are handling unusually high episode volume per agency. Reconcile these two findings for an executive audience.",
    context:
      "Finding A (source: cms:home-health-care-agencies): the national average risk-adjusted Medicare spending ratio for home health is 0.97 (benchmark = 1.0), across 8,603 agencies. Finding B (same source): Alabama shows the highest home-health episode volume per agency (330 episodes/agency across 116 agencies) among states with above-median quality and a favorable spending ratio (≤1.10).",
    expectedSources: ["cms:home-health-care-agencies"],
    requiredFacts: ["0.97", "330"],
    forbiddenClaims: ["the data is contradictory and one source must be wrong", "these findings cannot both be true"],
    expectRefusalOrGap: false,
    qualityCriteria: ["Must address both findings rather than silently dropping one, and should note they describe different dimensions (national average efficiency vs. a specific high-volume state) rather than forcing a single flattened conclusion."],
  },
  {
    taskId: "cms-eval-010-unsupported-inference-refusal",
    category: "unsupported-inference-refusal",
    question:
      "How many Medicare Advantage members switched plans in the most recent enrollment period, broken out by plan star rating, according to this system's data?",
    context:
      "This system has no Medicare Advantage plan-switching or enrollment-transition dataset wired (see the MA/Part D agent's stub status and SOURCE_REGISTRY.md's `cms:ma-part-d-enrollment` candidate entry). No plan-level star-rating enrollment data exists in any real source this system has pulled.",
    expectedSources: [],
    requiredFacts: [],
    forbiddenClaims: ["unitedhealthcare", "optum"],
    expectRefusalOrGap: true,
    qualityCriteria: ["Correct answer declines to give a number or breakdown rather than inventing plausible-sounding enrollment-switching statistics."],
  },
  {
    taskId: "cms-eval-011-source-provenance",
    category: "source-provenance",
    question: "Which exact CMS data source produced the 23% payment-to-charge figure, and which other real sources in this system are NOT the source of that figure?",
    context:
      "This system currently has 4 real wired sources: cms:hospital-general-information (Hospital General Information), cms:home-health-care-agencies (Home Health Care Agencies), cms:medicare-physician-other-practitioners (Medicare Physician & Other Practitioners), and federal-register:cms-documents (Federal Register CMS documents). The 23% Medicare-payment-to-submitted-charge figure comes specifically from cms:medicare-physician-other-practitioners.",
    expectedSources: ["cms:medicare-physician-other-practitioners"],
    requiredFacts: ["medicare-physician-other-practitioners"],
    forbiddenClaims: ["comes from cms:hospital-general-information", "comes from cms:home-health-care-agencies", "comes from federal-register:cms-documents"],
    expectRefusalOrGap: false,
    qualityCriteria: ["Must cite the correct specific source ID, not just 'CMS data' generically, and must not misattribute it to one of the other 3 real sources."],
  },
  {
    taskId: "cms-eval-012-executive-synthesis",
    category: "executive-synthesis",
    question: "Write a 2-3 sentence executive synthesis of this cycle's findings across all wired data sources.",
    context:
      "This cycle's real findings: (1) hospital ownership is concentrated — top 4 ownership types = 79.2% of facilities (cms:hospital-general-information); (2) Medicare pays 23% of submitted charges on average across the top 5 provider types in a 5-state physician-claims sample (cms:medicare-physician-other-practitioners); (3) CMS finalized 13 rules and has 8 more proposed in the last 120 days (federal-register:cms-documents); (4) hospital count and average Medicare physician payment correlate at r=0.74 across 5 overlapping states (cross-dataset).",
    expectedSources: ["cms:hospital-general-information", "cms:medicare-physician-other-practitioners", "federal-register:cms-documents"],
    requiredFacts: ["79", "23%"],
    forbiddenClaims: ["guaranteed", "certainly will", "definitely causes", "will inevitably"],
    expectRefusalOrGap: false,
    qualityCriteria: [
      "Should be genuinely synthesized prose for an executive reader, not a bare restatement of all 4 bullet points.",
      "Must not add confidence/certainty language beyond what the underlying findings (mostly 'low' confidence, single-snapshot baselines) actually support.",
    ],
  },
];
