/**
 * Medicaid managed care insights (Q064) from CMS's annual Managed Care
 * Enrollment by Program and Plan (data/adapters/medicaidManagedCare.ts).
 * Added 2026-09-25. Only comprehensive managed care counts as enrollment,
 * since dental, behavioral health and transportation programs count the
 * same people again. Parent organizations are grouped only by spellings
 * of the same name, and every parent figure says so.
 */
import {
  loadLatestSnapshot,
  normalizeParent,
  SOURCE_ID,
  type ManagedCarePlanRow,
  type ManagedCareSnapshot,
} from "../../data/adapters/medicaidManagedCare";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence } from "../../intelligence/trends/trend";
import type { AgentContext } from "../types";

const AGENT_ID = "medicaid-chip-dual-eligible-intelligence";
const TOP_N_STATES = 8;
const TOP_N_PARENTS = 8;

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const millions = (x: number) => `${(x / 1e6).toFixed(2)}M`;

const COMMON_LIMITATIONS = [
  "Annual and published with a lag of more than a year (2024 data came out in February 2026).",
  "Counts only comprehensive managed care; dental, behavioral-health-only, transportation and other limited programs are left out because they count the same people again.",
  "States report plans and parents in their own words, and a state's list of programs can change between years.",
];

const evidenceFor = (snapshot: ManagedCareSnapshot, id: string, prior: number, latest: number) => ({
  id,
  sourceId: SOURCE_ID,
  description: `CMS Medicaid Managed Care Enrollment by Program and Plan (data.medicaid.gov), comprehensive managed care, ${prior} and ${latest}`,
  datasetVintage: snapshot.pulledAt.slice(0, 10),
  url: "https://data.medicaid.gov/dataset/0bef7b8a-c663-5b14-9a46-0b5c2b86b0fe",
});

const comprehensive = (rows: ManagedCarePlanRow[], year: number) => rows.filter((r) => r.year === year && r.comprehensive && r.state !== null && r.totalEnrollment !== null);

function sumBy(rows: ManagedCarePlanRow[], key: (r: ManagedCarePlanRow) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) out.set(key(r), (out.get(key(r)) ?? 0) + r.totalEnrollment!);
  return out;
}

async function stateChangeInsight(snapshot: ManagedCareSnapshot, latest: number, prior: number, ctx: AgentContext): Promise<Insight | null> {
  const now = sumBy(comprehensive(snapshot.rows, latest), (r) => r.state!);
  const before = sumBy(comprehensive(snapshot.rows, prior), (r) => r.state!);
  const rows = [...now].flatMap(([state, value]) => {
    const then = before.get(state);
    return then ? [{ state, value, prior: then, growth: value / then - 1 }] : [];
  });
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.value, 0);
  const totalPrior = rows.reduce((s, r) => s + r.prior, 0);
  const growth = total / totalPrior - 1;
  const describe = (r: (typeof rows)[number]) => `${r.prior.toLocaleString()} to ${r.value.toLocaleString()} enrollees in comprehensive managed care (${pct(r.growth)})`;
  const candidates: Candidate[] = rows.map((r) => ({ id: r.state, label: r.state, summary: describe(r), primaryMetric: r.growth }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_STATES, taskDescription: `Medicaid comprehensive managed care enrollment change by state, ${prior} to ${latest}`, direction: "lowest" },
    ctx
  );
  const byState = new Map(rows.map((r) => [r.state, r]));
  const selected = selections.map((s) => ({ row: byState.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;
  const ranked = [...rows].sort((a, b) => a.growth - b.growth);
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-medicaid-managed-care-${latest}-by-state`,
    headline: `Comprehensive Medicaid managed care enrollment ${growth < 0 ? "fell" : "rose"} ${pct(Math.abs(growth)).slice(1)} to ${millions(total)} in ${latest} across the ${rows.length} states that use it in both years; ${ranked[0].state} changed most (${pct(ranked[0].growth)}).`,
    questionId: "Q064",
    signalType: "baseline",
    period: { start: `${prior}-01-01`, end: `${latest}-12-31` },
    population: "medicaid",
    geography: { level: "state", code: "US-STATES", label: `${rows.length} states with comprehensive managed care in ${prior} and ${latest}` },
    magnitude: { value: growth * 100, unit: "percent", comparedTo: `${prior} comprehensive managed care enrollment, same states`, delta: total - totalPrior },
    drivers: [
      {
        description: `Comprehensive managed care enrollment, summed over each state's plans: ${millions(totalPrior)} in ${prior} to ${millions(total)} in ${latest} (${pct(growth)}) across ${rows.length} states. By state: ${selected.map(({ row, rationale }) => `${row.state}: ${describe(row)}${source === "llm" ? ` - ${rationale}` : ""}`).join("; ")}.${source === "llm" ? ` Candidate selection method: model-reasoned salience ranking over all ${rows.length} states.` : " Candidate selection method: deterministic ranking, largest declines first."}`,
        supportingEvidenceIds: ["ev-medicaid-mc-states"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Comprehensive managed care is how most Medicaid enrollees get coverage, so this is the size of the contracted Medicaid market each state offers health plans (Q064).",
    evidence: [evidenceFor(snapshot, "ev-medicaid-mc-states", prior, latest)],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} States' own plan-level counts; a single year-over-year change is a baseline, not a trend.`,
    freshness: { dataAsOf: snapshot.pulledAt.slice(0, 10), generatedAt: new Date().toISOString(), isStale: false },
    limitations: COMMON_LIMITATIONS,
    nextSignal: `CMS's ${latest + 1} release (expected early ${latest + 2}) will show whether the states that fell most kept falling.`,
    recommendedInternalValidation: "Compare against a plan's own Medicaid managed care membership by state.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Comprehensive Medicaid managed care enrollment change by state, ${prior} to ${latest}`,
      unit: "% change",
      bars: selected.map(({ row }) => ({ label: row.state, value: Math.round(row.growth * 1000) / 10 })).sort((a, b) => a.value - b.value),
    },
  });
}

function parentInsight(snapshot: ManagedCareSnapshot, latest: number, prior: number): Insight | null {
  const nowRows = comprehensive(snapshot.rows, latest).filter((r) => r.parent);
  const beforeRows = comprehensive(snapshot.rows, prior).filter((r) => r.parent);
  if (nowRows.length === 0) return null;
  const now = sumBy(nowRows, (r) => normalizeParent(r.parent));
  const before = sumBy(beforeRows, (r) => normalizeParent(r.parent));
  const statesOf = (name: string) => new Set(nowRows.filter((r) => normalizeParent(r.parent) === name).map((r) => r.state)).size;
  const top = [...now].sort((a, b) => b[1] - a[1]).slice(0, TOP_N_PARENTS);
  const [leader, leaderValue] = top[0];
  const leaderPrior = before.get(leader);
  const describe = ([name, value]: [string, number]) => {
    const then = before.get(name);
    return `${name}: ${millions(value)} in ${statesOf(name)} state${statesOf(name) === 1 ? "" : "s"}${then ? ` (${millions(then)} in ${prior}, ${pct(value / then - 1)})` : ` (no ${prior} entry under this name)`}`;
  };
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: false, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-medicaid-managed-care-${latest}-parents`,
    headline: `Among parent organizations as named in states' ${latest} reports, ${leader} had the most comprehensive Medicaid managed care enrollees (${millions(leaderValue)} in ${statesOf(leader)} states${leaderPrior ? `, ${pct(leaderValue / leaderPrior - 1)} from ${prior}` : ""}); states name parents inconsistently, so company totals are understated.`,
    questionId: "Q064",
    signalType: "baseline",
    period: { start: `${prior}-01-01`, end: `${latest}-12-31` },
    population: "medicaid",
    geography: { level: "national", code: "US", label: "States with comprehensive Medicaid managed care" },
    magnitude: { value: leaderValue, unit: "enrollees", comparedTo: `${leader} as named in ${prior} reports`, ...(leaderPrior ? { delta: leaderValue - leaderPrior } : {}) },
    drivers: [
      {
        description: `Largest parent organizations by comprehensive Medicaid managed care enrollment in ${latest}, grouped only by spellings of the same name: ${top.map(describe).join("; ")}.`,
        supportingEvidenceIds: ["ev-medicaid-mc-parents"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Which health plan companies hold the most Medicaid managed care membership, and whose footprint grew or shrank (Q064); the same companies appear in Medicare Advantage, so this links the two programs.",
    evidence: [evidenceFor(snapshot, "ev-medicaid-mc-parents", prior, latest)],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Parent names are as each state reported them, not verified company ownership.`,
    freshness: { dataAsOf: snapshot.pulledAt.slice(0, 10), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "The same company can appear under several parent names (for example \"UnitedHealthcare\" and \"UnitedHealth Group\"), and some subsidiaries are listed as their own parent. Only spellings of one name are merged, never different names, so a company's true total can be larger than shown.",
      "A change for one parent name can come from a state renaming the parent rather than from members moving.",
    ],
    nextSignal: "Compare with the Medicare Advantage parent-organization ranking to see which companies are growing in one program and shrinking in the other.",
    recommendedInternalValidation: "Check a company's reported Medicaid membership in its own filings against the total shown under its name here.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Comprehensive Medicaid managed care enrollees by parent organization as named by states, ${latest} (millions)`,
      unit: "millions of enrollees",
      bars: top.map(([name, value]) => ({ label: name, value: Math.round(value / 1e4) / 100 })),
    },
  });
}

export async function managedCareInsights(ctx: AgentContext, snapshot: ManagedCareSnapshot | null = loadLatestSnapshot()): Promise<Insight[]> {
  if (!snapshot) return [];
  const years = [...new Set(snapshot.rows.filter((r) => r.comprehensive).map((r) => r.year))].sort();
  const latest = years.at(-1);
  const prior = years.at(-2);
  if (latest === undefined || prior === undefined) return [];
  const insights = [await stateChangeInsight(snapshot, latest, prior, ctx), parentInsight(snapshot, latest, prior)];
  return insights.filter((i): i is Insight => i !== null);
}
