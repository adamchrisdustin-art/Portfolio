/**
 * Medicaid and CHIP enrollment insights (Q056) from the states' monthly
 * reports to CMS (data/adapters/medicaidEnrollment.ts). Added 2026-09-25.
 *
 * Two rules keep the comparisons honest:
 * - Like with like: each state reports a month twice, preliminary then
 *   final, and preliminary totals run lower. The newest month exists only
 *   as preliminary, so year-over-year compares it with the preliminary
 *   report for the same month a year earlier; history uses final reports.
 * - Per-state vintage: AGENT_ARCHITECTURE.md section 7 requires every
 *   state figure to say which report it came from, so each state's
 *   evidence names its month and report status.
 */
import {
  comparableValue,
  loadLatestSnapshot,
  SOURCE_ID,
  type MedicaidEnrollmentSnapshot,
  type MedicaidReport,
} from "../../data/adapters/medicaidEnrollment";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence, directionOf, meetsPersistence } from "../../intelligence/trends/trend";
import type { AgentContext } from "../types";

const AGENT_ID = "medicaid-chip-dual-eligible-intelligence";
const TOP_N_STATES = 8;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const millions = (x: number) => `${(x / 1e6).toFixed(2)}M`;
const monthLabel = (month: string) => `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
const yearEarlier = (month: string) => `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;
const monthEnd = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

const COMMON_LIMITATIONS = [
  "State-reported counts from each state's eligibility system, not T-MSIS claims data; states differ in reporting cadence and definitions, so each state figure names its own report month and status.",
  "Preliminary reports run lower than the final reports that replace them about a month later; every comparison here pairs preliminary with preliminary or final with final.",
  "No disenrollment or renewal counts in this file, so these are net changes, not churn.",
  "The file has a September 2013 baseline and then continuous months from June 2017, so monthly history starts in June 2017.",
];

const evidenceFor = (snapshot: MedicaidEnrollmentSnapshot, id: string, months: string[]) => ({
  id,
  sourceId: SOURCE_ID,
  description: `CMS State Medicaid and CHIP Applications, Eligibility Determinations, and Enrollment Data (data.medicaid.gov), every state and DC, ${monthLabel(months[0])} to ${monthLabel(months[months.length - 1])}`,
  datasetVintage: snapshot.pulledAt.slice(0, 10),
  url: "https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360",
});

type Field = "totalEnrollment" | "adultMedicaidEnrollment" | "childEnrollment";

interface StateChange {
  state: string;
  current: number;
  prior: number;
  growth: number;
  expanded: boolean | null;
  adultGrowth: number | null;
  childGrowth: number | null;
}

/** Year-over-year change per state for the newest month, preliminary against preliminary. */
function stateChanges(reports: MedicaidReport[], month: string): StateChange[] {
  const prior = yearEarlier(month);
  const states = [...new Set(reports.map((r) => r.state))].sort();
  const growthOf = (state: string, field: Field) => {
    const now = comparableValue(reports, state, month, "P", field);
    const then = comparableValue(reports, state, prior, "P", field);
    return now !== null && then ? now / then - 1 : null;
  };
  return states.flatMap((state) => {
    const current = comparableValue(reports, state, month, "P", "totalEnrollment");
    const before = comparableValue(reports, state, prior, "P", "totalEnrollment");
    if (current === null || !before) return [];
    const report = reports.find((r) => r.state === state && r.month === month && r.status === "P")!;
    return [{ state, current, prior: before, growth: current / before - 1, expanded: report.expandedMedicaid, adultGrowth: growthOf(state, "adultMedicaidEnrollment"), childGrowth: growthOf(state, "childEnrollment") }];
  });
}

/** Growth of a group's summed field, over states reporting it in both months. */
function groupGrowth(reports: MedicaidReport[], states: string[], month: string, field: Field): number | null {
  let now = 0;
  let then = 0;
  for (const state of states) {
    const a = comparableValue(reports, state, month, "P", field);
    const b = comparableValue(reports, state, yearEarlier(month), "P", field);
    if (a === null || b === null) continue;
    now += a;
    then += b;
  }
  return then > 0 ? now / then - 1 : null;
}

/** National total from final reports, only for months every state has a final report for. */
function finalNationalSeries(reports: MedicaidReport[]): { month: string; value: number }[] {
  const states = new Set(reports.map((r) => r.state));
  const byMonth = new Map<string, { sum: number; count: number }>();
  for (const r of reports) {
    if (r.status !== "U" || r.totalEnrollment === null) continue;
    const entry = byMonth.get(r.month) ?? { sum: 0, count: 0 };
    entry.sum += r.totalEnrollment;
    entry.count++;
    byMonth.set(r.month, entry);
  }
  return [...byMonth]
    .filter(([, e]) => e.count === states.size)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, e]) => ({ month, value: e.sum }));
}

function nationalTrendInsight(snapshot: MedicaidEnrollmentSnapshot, month: string, rows: StateChange[]): Insight | null {
  const reports = snapshot.reports;
  const series = finalNationalSeries(reports);
  if (series.length < 13 || rows.length === 0) return null;
  const allStates = rows.map((r) => r.state);
  const now = rows.reduce((s, r) => s + r.current, 0);
  const before = rows.reduce((s, r) => s + r.prior, 0);
  const growth = now / before - 1;
  const peak = series.reduce((a, b) => (b.value > a.value ? b : a));
  const lastFinal = series[series.length - 1];
  // Persistence: direction of each of the last 3 years' final-report changes, same calendar month.
  const sameMonth = series.filter((p) => p.month.slice(5) === lastFinal.month.slice(5)).slice(-4);
  const directions = sameMonth.slice(1).map((p, i) => directionOf(p.value, sameMonth[i].value));
  const persistent = meetsPersistence(directions);
  const confidence = classifyConfidence({ persistenceMet: persistent, hasFullBaseline: true, hasExternalCorroboration: false });
  const adults = groupGrowth(reports, allStates, month, "adultMedicaidEnrollment");
  const children = groupGrowth(reports, allStates, month, "childEnrollment");
  const expansion = rows.filter((r) => r.expanded === true).map((r) => r.state);
  const nonExpansion = rows.filter((r) => r.expanded === false).map((r) => r.state);
  const expansionAdults = groupGrowth(reports, expansion, month, "adultMedicaidEnrollment");
  const nonExpansionAdults = groupGrowth(reports, nonExpansion, month, "adultMedicaidEnrollment");
  const fell = rows.filter((r) => r.growth < 0).length;

  return validateInsight({
    id: `sig-medicaid-${month}-enrollment-trend`,
    headline: `Medicaid and CHIP enrollment ${growth < 0 ? "fell" : "rose"} ${pct(Math.abs(growth)).slice(1)} year over year to ${millions(now)} in ${monthLabel(month)} (preliminary), ${growth < 0 ? "falling" : "rising"} in ${growth < 0 ? fell : rows.length - fell} of ${rows.length} states; it peaked at ${millions(peak.value)} in ${monthLabel(peak.month)}.`,
    questionId: "Q056",
    signalType: persistent ? "trend" : "baseline",
    period: { start: `${series[0].month}-01`, end: monthEnd(month) },
    population: "medicaid",
    geography: { level: "national", code: "US", label: "All 50 states and DC" },
    magnitude: { value: growth * 100, unit: "percent", comparedTo: `${monthLabel(yearEarlier(month))} preliminary reports`, delta: now - before },
    drivers: [
      {
        description: `Total Medicaid and CHIP enrollment, summed across all ${rows.length} states and DC from preliminary reports: ${millions(before)} in ${monthLabel(yearEarlier(month))} to ${millions(now)} in ${monthLabel(month)} (${pct(growth)}). From final reports: ${millions(peak.value)} at the ${monthLabel(peak.month)} peak, ${millions(lastFinal.value)} in ${monthLabel(lastFinal.month)}, the latest month with final reports.${adults !== null ? ` Adults in Medicaid ${pct(adults)}` : ""}${children !== null ? `, children in Medicaid and CHIP ${pct(children)}` : ""}.${expansionAdults !== null && nonExpansionAdults !== null ? ` Adult Medicaid enrollment changed ${pct(expansionAdults)} in the ${expansion.length} states that expanded Medicaid (expansion status as each state reported it) and ${pct(nonExpansionAdults)} in the ${nonExpansion.length} that haven't.` : ""}`,
        supportingEvidenceIds: ["ev-medicaid-national"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Medicaid is the largest coverage program by enrollment; a sustained national decline shrinks managed Medicaid membership for every state contractor and can push people toward the Marketplace or uninsurance.",
    evidence: [evidenceFor(snapshot, "ev-medicaid-national", [series[0].month, month])],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Every state and DC reported; the newest month is preliminary and is compared only with the preliminary report a year earlier.`,
    freshness: { dataAsOf: snapshot.pulledAt.slice(0, 10), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [...COMMON_LIMITATIONS, "The file doesn't say why enrollment changed; policy and eligibility changes are context, not measured causes."],
    nextSignal: `Final reports for ${monthLabel(month)} arrive about a month after the preliminary ones; check whether they confirm the same year-over-year change.`,
    recommendedInternalValidation: "Compare against a plan's own Medicaid membership change in the same states and months.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: {
      label: "Medicaid and CHIP enrollment, all states and DC (final reports)",
      unit: "enrollees",
      points: series.map((p) => ({ date: `${p.month}-01`, value: p.value })),
    },
  });
}

async function stateChangeInsight(snapshot: MedicaidEnrollmentSnapshot, month: string, rows: StateChange[], ctx: AgentContext): Promise<Insight | null> {
  if (rows.length === 0) return null;
  const vintage = `${monthLabel(month)} vs ${monthLabel(yearEarlier(month))}, both preliminary`;
  const describe = (r: StateChange) =>
    `${r.prior.toLocaleString()} to ${r.current.toLocaleString()} enrollees (${pct(r.growth)}; ${vintage})${r.adultGrowth !== null ? `, adults ${pct(r.adultGrowth)}` : ""}${r.childGrowth !== null ? `, children ${pct(r.childGrowth)}` : ""}${r.expanded === null ? "" : r.expanded ? ", expansion state" : ", non-expansion state"}`;
  const candidates: Candidate[] = rows.map((r) => ({ id: r.state, label: r.state, summary: describe(r), primaryMetric: r.growth }));
  const { selections, source } = await selectNoteworthy(
    {
      candidates,
      topN: TOP_N_STATES,
      taskDescription: `Medicaid and CHIP enrollment change by state, ${monthLabel(yearEarlier(month))} to ${monthLabel(month)}`,
      direction: "lowest",
    },
    ctx
  );
  const byState = new Map(rows.map((r) => [r.state, r]));
  const selected = selections.map((s) => ({ row: byState.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;
  const ranked = [...rows].sort((a, b) => a.growth - b.growth);
  const worst = ranked[0];
  const best = ranked[ranked.length - 1];
  const largestLoss = [...rows].sort((a, b) => a.current - a.prior - (b.current - b.prior))[0];
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-medicaid-${month}-enrollment-by-state`,
    headline: `${worst.state} had the steepest Medicaid and CHIP enrollment change over the year to ${monthLabel(month)} (${pct(worst.growth)}) and ${best.state} the strongest (${pct(best.growth)}); ${largestLoss.current < largestLoss.prior ? `${largestLoss.state} lost the most people, ${(largestLoss.prior - largestLoss.current).toLocaleString()}.` : "no state lost enrollees."}`,
    questionId: "Q056",
    signalType: "baseline",
    period: { start: `${yearEarlier(month)}-01`, end: monthEnd(month) },
    population: "medicaid",
    geography: { level: "state", code: "US-STATES", label: `${rows.length} states and DC` },
    magnitude: { value: worst.growth * 100, unit: "percent", comparedTo: `${worst.state} ${monthLabel(yearEarlier(month))} preliminary report` },
    drivers: [
      {
        description: `Medicaid and CHIP enrollment by state, each from the state's own preliminary reports: ${selected.map(({ row, rationale }) => `${row.state}: ${describe(row)}${source === "llm" ? ` - ${rationale}` : ""}`).join("; ")}.${source === "llm" ? ` Candidate selection method: model-reasoned salience ranking over all ${rows.length} states and DC.` : " Candidate selection method: deterministic ranking, largest declines first."}`,
        supportingEvidenceIds: ["ev-medicaid-states"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Where Medicaid membership is shrinking or growing fastest - the states where managed Medicaid contractors' volume, and the risk mix of who stays enrolled, are shifting most.",
    evidence: [evidenceFor(snapshot, "ev-medicaid-states", [yearEarlier(month), month])],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Each state's own count; one year's state ranking is a baseline, not a trend.`,
    freshness: { dataAsOf: snapshot.pulledAt.slice(0, 10), generatedAt: new Date().toISOString(), isStale: false },
    limitations: COMMON_LIMITATIONS,
    nextSignal: "Watch whether the steepest-declining states keep falling in the next monthly reports; two more months in the same direction meets the persistence rule.",
    recommendedInternalValidation: "Compare against a plan's own Medicaid membership change by state.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Medicaid and CHIP enrollment change by state, ${monthLabel(yearEarlier(month))} to ${monthLabel(month)} (preliminary reports)`,
      unit: "% change",
      bars: selected.map(({ row }) => ({ label: row.state, value: Math.round(row.growth * 1000) / 10 })).sort((a, b) => a.value - b.value),
    },
  });
}

export async function medicaidEnrollmentInsights(ctx: AgentContext, snapshot: MedicaidEnrollmentSnapshot | null = loadLatestSnapshot()): Promise<Insight[]> {
  if (!snapshot || snapshot.reports.length === 0) return [];
  const month = snapshot.reports.filter((r) => r.status === "P").map((r) => r.month).sort().at(-1);
  if (!month) return [];
  const rows = stateChanges(snapshot.reports, month);
  const insights = [nationalTrendInsight(snapshot, month, rows), await stateChangeInsight(snapshot, month, rows, ctx)];
  return insights.filter((i): i is Insight => i !== null);
}
