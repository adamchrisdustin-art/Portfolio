/**
 * MA agent insights from the monthly enrollment history
 * (data/adapters/maPartDHistory.ts, added 2026-09-25): real month-over-
 * month and year-over-year changes, answering Q046 ("where is MA
 * enrollment changing?") and Q049 ("which plan structures are changing?")
 * directly instead of from a single snapshot.
 *
 * Year-over-year compares the same calendar month, because MA enrollment
 * jumps every January when Annual Election Period choices take effect -
 * a sequential comparison across January would mostly measure that.
 * Medicare Advantage and standalone Part D are always kept separate.
 */
import { SOURCE_ID } from "../../data/adapters/maPartDEnrollment";
import type { MaMonthSummary } from "../../data/adapters/maPartDHistory";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence } from "../../intelligence/trends/trend";
import type { AgentContext } from "../types";

const AGENT_ID = "medicare-advantage-part-d-intelligence";
const TOP_N_SHARE_SHIFTS = 6;
/** Parent organizations below this MA share in both months are left out - a tiny plan's share swings on a few thousand members. */
const MIN_MA_SHARE = 0.005;
const MA_PLAN_TYPES = new Set(["HMO", "HMOPOS", "Local PPO", "Regional PPO", "PFFS", "MSA"]);

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const pts = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)} pts`;
const share = (x: number) => `${(x * 100).toFixed(2)}%`;
const millions = (x: number) => `${(x / 1e6).toFixed(2)}M`;

/** The same calendar month `years` earlier, if it's on disk. */
function monthsBack(months: MaMonthSummary[], period: string, years: number): MaMonthSummary | null {
  const target = `${Number(period.slice(0, 4)) - years}${period.slice(4)}`;
  return months.find((m) => m.reportPeriod === target) ?? null;
}

const evidence = (months: MaMonthSummary[], id: string) => ({
  id,
  sourceId: SOURCE_ID,
  description: `CMS Monthly Enrollment by Plan, every month ${months[0].reportPeriod} to ${months[months.length - 1].reportPeriod} (${months.length} monthly files), summarized at pull time`,
  datasetVintage: `${months[months.length - 1].reportPeriod}-01`,
});

const COMMON_LIMITATIONS = [
  "National plan-level file - no state or county geography.",
  "CMS suppresses plans with 10 or fewer enrollees each month; those are excluded, so totals run slightly under CMS's published contract-level counts.",
];

function enrollmentTrendInsight(months: MaMonthSummary[]): Insight | null {
  const latest = months[months.length - 1];
  const yearAgo = monthsBack(months, latest.reportPeriod, 1);
  const twoYearsAgo = monthsBack(months, latest.reportPeriod, 2);
  if (!yearAgo) return null;
  const prevMonth = months[months.length - 2];

  const maYoY = latest.totals.ma / yearAgo.totals.ma - 1;
  const pdpYoY = latest.totals.pdp / yearAgo.totals.pdp - 1;
  const priorMaYoY = twoYearsAgo ? yearAgo.totals.ma / twoYearsAgo.totals.ma - 1 : null;
  const maMoM = prevMonth ? latest.totals.ma / prevMonth.totals.ma - 1 : null;
  const persistent = priorMaYoY !== null && Math.sign(maYoY) === Math.sign(priorMaYoY) && maYoY !== 0;
  const confidence = classifyConfidence({ persistenceMet: persistent, hasFullBaseline: twoYearsAgo !== null, hasExternalCorroboration: false });
  const pace =
    priorMaYoY === null
      ? ""
      : maYoY < priorMaYoY
        ? `, slower than ${pct(priorMaYoY)} the year before`
        : maYoY > priorMaYoY
          ? `, faster than ${pct(priorMaYoY)} the year before`
          : "";

  return validateInsight({
    id: `sig-ma-partd-${latest.reportPeriod}-ma-enrollment-trend`,
    headline: `Medicare Advantage enrollment reached ${millions(latest.totals.ma)} in ${latest.reportPeriod}, ${pct(maYoY)} year over year${pace}; standalone Part D plans ${pct(pdpYoY)} to ${millions(latest.totals.pdp)}.`,
    questionId: "Q046",
    signalType: persistent ? "trend" : "baseline",
    period: { start: `${(twoYearsAgo ?? yearAgo).reportPeriod}-01`, end: `${latest.reportPeriod}-01` },
    population: "medicare-advantage",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: maYoY * 100, unit: "percent", comparedTo: `${yearAgo.reportPeriod} Medicare Advantage enrollment (${millions(yearAgo.totals.ma)})`, delta: latest.totals.ma - yearAgo.totals.ma },
    drivers: [
      {
        description: `Enrollment summed by segment from each month's plan file. Medicare Advantage: ${millions(yearAgo.totals.ma)} in ${yearAgo.reportPeriod} to ${millions(latest.totals.ma)} in ${latest.reportPeriod} (${pct(maYoY)})${priorMaYoY !== null && twoYearsAgo ? `, after ${pct(priorMaYoY)} from ${twoYearsAgo.reportPeriod}` : ""}${maMoM !== null && prevMonth ? `; ${pct(maMoM)} from ${prevMonth.reportPeriod}` : ""}. Standalone Part D: ${millions(yearAgo.totals.pdp)} to ${millions(latest.totals.pdp)} (${pct(pdpYoY)}). ${share(latest.maWithPartD / latest.totals.ma)} of MA enrollees are in plans that include drug coverage.`,
        supportingEvidenceIds: ["ev-ma-history-trend"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "The growth rate of the Medicare Advantage market itself - whether it's still expanding, and how fast, sets the size of the prize every MA plan and MA-contracting provider is competing for.",
    evidence: [evidence(months, "ev-ma-history-trend")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Based on ${months.length} real monthly files; year-over-year compares the same calendar month to avoid the January enrollment jump.`,
    freshness: { dataAsOf: `${latest.reportPeriod}-01`, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "Enrollment counts, not penetration - growth here includes growth in the overall Medicare population, which this file doesn't report.",
      "MA enrollment jumps each January when Annual Election Period choices take effect; month-over-month changes across January mostly reflect that.",
    ],
    nextSignal: "Watch the January report after the next Annual Election Period - it shows how much of the coming year's MA growth has already happened.",
    recommendedInternalValidation: "Compare a plan's own membership growth against this national rate for the same months.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: {
      label: "Medicare Advantage enrollment",
      unit: "enrollees",
      points: months.map((m) => ({ date: `${m.reportPeriod}-01`, value: m.totals.ma })),
    },
  });
}

async function shareShiftInsight(months: MaMonthSummary[], ctx: AgentContext): Promise<Insight | null> {
  const latest = months[months.length - 1];
  const yearAgo = monthsBack(months, latest.reportPeriod, 1);
  if (!yearAgo) return null;

  const maShares = (m: MaMonthSummary) => new Map(m.byParentOrganization.filter((p) => p.ma > 0).map((p) => [p.parentOrganization, p.ma / m.totals.ma]));
  const now = maShares(latest);
  const then = maShares(yearAgo);
  const rows = [...new Set([...now.keys(), ...then.keys()])]
    .map((name) => ({ name, now: now.get(name) ?? 0, then: then.get(name) ?? 0 }))
    .filter((r) => Math.max(r.now, r.then) >= MIN_MA_SHARE)
    .map((r) => ({ ...r, change: r.now - r.then }));
  if (rows.length === 0) return null;

  const describe = (r: (typeof rows)[number]) => `${share(r.then)} to ${share(r.now)} of MA enrollment (${pts(r.change)})`;
  const candidates: Candidate[] = rows.map((r) => ({ id: r.name, label: r.name, summary: describe(r), primaryMetric: Math.abs(r.change) }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_SHARE_SHIFTS, taskDescription: `Medicare Advantage market-share change by parent organization, ${yearAgo.reportPeriod} to ${latest.reportPeriod}` },
    ctx
  );
  const byName = new Map(rows.map((r) => [r.name, r]));
  const selected = selections.map((s) => ({ row: byName.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;

  const sorted = [...rows].sort((a, b) => b.change - a.change);
  const gainer = sorted[0];
  const loser = sorted[sorted.length - 1];
  const maYoY = latest.totals.ma / yearAgo.totals.ma - 1;
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: monthsBack(months, latest.reportPeriod, 2) !== null, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-ma-partd-${latest.reportPeriod}-ma-share-shift`,
    headline: `${gainer.name} gained the most Medicare Advantage share from ${yearAgo.reportPeriod} to ${latest.reportPeriod} (${pts(gainer.change)} to ${share(gainer.now)} of MA enrollment); ${loser.name} lost the most (${pts(loser.change)} to ${share(loser.now)}), while MA overall grew ${pct(maYoY)}.`,
    questionId: "Q046",
    signalType: "structural-change",
    period: { start: `${yearAgo.reportPeriod}-01`, end: `${latest.reportPeriod}-01` },
    population: "medicare-advantage",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: gainer.change * 100, unit: "percentage-points", comparedTo: `${gainer.name}'s ${yearAgo.reportPeriod} MA share (${share(gainer.then)})` },
    drivers: [
      {
        description: `Each parent organization's Medicare Advantage enrollment as a share of all MA enrollment, same month a year apart (organizations with at least ${share(MIN_MA_SHARE)} share in either month): ${selected.map(({ row, rationale }) => `${row.name}: ${describe(row)}${source === "llm" ? ` - ${rationale}` : ""}`).join("; ")}. Candidate selection method: ${source === "llm" ? `model-reasoned salience ranking over all ${rows.length} parent organizations` : "deterministic ranking by size of share change"}.`,
        supportingEvidenceIds: ["ev-ma-history-share"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Who is winning and losing Medicare Advantage members - the competitive picture behind network contracting, broker strategy and benefit design, measured on MA alone rather than blended with standalone drug plans.",
    evidence: [evidence(months, "ev-ma-history-share")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} A one-year share change between two monthly files; direction over further years would make it a trend.`,
    freshness: { dataAsOf: `${latest.reportPeriod}-01`, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "Shares use CMS's Parent Organization field as filed each month; an acquisition or renamed parent moves members between names.",
      "A real, sourced market-share reading from public CMS data, not any carrier's internal data.",
    ],
    nextSignal: "Watch the January report: Annual Election Period switching is when most share moves.",
    recommendedInternalValidation: "Compare against a plan's own county-level share, which this national file can't show.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Change in Medicare Advantage share, ${yearAgo.reportPeriod} to ${latest.reportPeriod}`,
      unit: "percentage points",
      bars: selected.map(({ row }) => ({ label: row.name, value: Math.round(row.change * 10000) / 100 })),
    },
  });
}

function planTypeShiftInsight(months: MaMonthSummary[]): Insight | null {
  const latest = months[months.length - 1];
  const yearAgo = monthsBack(months, latest.reportPeriod, 1);
  if (!yearAgo) return null;

  const shares = (m: MaMonthSummary) => new Map(m.byPlanType.filter((t) => MA_PLAN_TYPES.has(t.planType)).map((t) => [t.planType, t.ma / m.totals.ma]));
  const now = shares(latest);
  const then = shares(yearAgo);
  const rows = [...now.keys()]
    .filter((t) => then.has(t))
    .map((t) => ({ planType: t, now: now.get(t)!, then: then.get(t)!, change: now.get(t)! - then.get(t)! }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  if (rows.length === 0) return null;
  const biggest = rows[0];
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: monthsBack(months, latest.reportPeriod, 2) !== null, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-ma-partd-${latest.reportPeriod}-ma-plan-type-shift`,
    headline: `${biggest.planType} plans moved from ${share(biggest.then)} to ${share(biggest.now)} of Medicare Advantage enrollment between ${yearAgo.reportPeriod} and ${latest.reportPeriod} (${pts(biggest.change)}), the largest shift among MA plan types.`,
    questionId: "Q049",
    signalType: "structural-change",
    period: { start: `${yearAgo.reportPeriod}-01`, end: `${latest.reportPeriod}-01` },
    population: "medicare-advantage",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: biggest.change * 100, unit: "percentage-points", comparedTo: `${biggest.planType} share in ${yearAgo.reportPeriod}` },
    drivers: [
      {
        description: `Each MA plan type's share of Medicare Advantage enrollment, same month a year apart: ${rows.map((r) => `${r.planType}: ${share(r.then)} to ${share(r.now)} (${pts(r.change)})`).join("; ")}.`,
        supportingEvidenceIds: ["ev-ma-history-plan-types"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Whether members are moving toward open-network PPOs or tighter HMO designs changes how much leverage a plan's network gives it - and what kind of contracts providers will be asked to sign.",
    evidence: [evidence(months, "ev-ma-history-plan-types")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} A one-year mix change between two monthly files.`,
    freshness: { dataAsOf: `${latest.reportPeriod}-01`, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [...COMMON_LIMITATIONS, "Plan type is CMS's plan-level category; Special Needs Plans are not broken out in this file."],
    nextSignal: "Check whether the shift continues in the next January report, when new plan-year choices take effect.",
    recommendedInternalValidation: "Compare against the plan-type mix of a plan's own MA membership.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Change in share of Medicare Advantage enrollment by plan type, ${yearAgo.reportPeriod} to ${latest.reportPeriod}`,
      unit: "percentage points",
      bars: rows.map((r) => ({ label: r.planType, value: Math.round(r.change * 10000) / 100 })),
    },
  });
}

/** All MA history insights, or none until a same-month-a-year-earlier file exists. */
export async function buildMaTrendInsights(months: MaMonthSummary[], ctx: AgentContext): Promise<Insight[]> {
  if (months.length < 2) return [];
  const insights = [enrollmentTrendInsight(months), await shareShiftInsight(months, ctx), planTypeShiftInsight(months)];
  return insights.filter((i): i is Insight => i !== null);
}
