/**
 * Claims-agent insights by service (added 2026-09-25), from the national
 * per-code Medicare Part B totals in data/adapters/physicianServiceSummary.ts
 * and CMS's own service categories (RBCS). Where physicianTrendInsights.ts
 * answers "which specialties", this answers "which services" - Q011's
 * fastest utilization growth and Q012's fastest cost growth - by category
 * and by individual code, plus the rising share of Part B drugs.
 *
 * Every number is computed here in code; the salience layer only chooses
 * which rows to show.
 */
import { loadRbcsMap, SOURCE_ID, type RbcsEntry, type ServiceYearData } from "../../data/adapters/physicianServiceSummary";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { checkAgainstHistory, isSplitReliable, splitGrowth, SPLIT_SWING_LIMIT, type GrowthDecomposition, type HistoryCheck } from "../../intelligence/metrics/physicianTrends";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence, directionOf, meetsPersistence } from "../../intelligence/trends/trend";
import type { AgentContext } from "../types";

const AGENT_ID = "claims-utilization-cost-intelligence";
const TOP_N_CATEGORIES = 6;
const TOP_N_CODES = 8;
/** Codes smaller than this in the latest year are left out of the per-code ranking. */
const MIN_CODE_PAYMENT = 50_000_000;
/**
 * A code needs this much prior-year payment for its growth rate to mean anything. Below it, the code is treated as
 * new or near-new - seen live in 2024: a flu vaccine code went from $0M to $291M and a skin substitute from $5M to $931M,
 * percentages in the tens of thousands that describe a new product, not growth.
 */
const MIN_PRIOR_PAYMENT = 10_000_000;
const TOP_N_EMERGING = 5;

interface Totals {
  medicarePayment: number;
  services: number;
}

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const money = (x: number) => (Math.abs(x) >= 1e9 ? `$${(x / 1e9).toFixed(2)}B` : `$${(x / 1e6).toFixed(0)}M`);
const yearEnd = (year: number) => `${year}-12-31`;
/** Some CMS code descriptions run past 300 characters (G2211's); keep text readable. */
const short = (text: string) => (text.length > 70 ? `${text.slice(0, 67).trimEnd()}...` : text);

function historyNote(check: HistoryCheck | null, since: number, priorYear: number): string {
  if (!check) return "can't yet be judged against its own history (too few years)";
  return `${check.anomalous ? "breaks from" : "in line with"} its own ${since}-${priorYear} pattern (median yearly change ${pct(check.medianGrowth)})`;
}

function splitText(split: GrowthDecomposition): string {
  return isSplitReliable(split)
    ? `services ${pct(split.volume)}, payment per service ${pct(split.price)}`
    : `services and payment per service swung in opposite directions (${pct(split.volume)} / ${pct(split.price)}), usually a change in how units were counted, so the split isn't reliable`;
}

function subcategoryOf(rbcs: Record<string, RbcsEntry>, code: string): string {
  const entry = rbcs[code];
  return entry ? `${entry.category}: ${entry.subcategory}` : "Unclassified";
}

function rollUp(year: ServiceYearData, keyOf: (code: string, isDrug: boolean) => string): Map<string, Totals> {
  const out = new Map<string, Totals>();
  for (const s of year.services) {
    const key = keyOf(s.code, s.isDrug);
    const t = out.get(key) ?? { medicarePayment: 0, services: 0 };
    t.medicarePayment += s.medicarePayment;
    t.services += s.services;
    out.set(key, t);
  }
  return out;
}

const evidenceFor = (years: ServiceYearData[], id: string) => ({
  id,
  sourceId: SOURCE_ID,
  description: `CMS Medicare Physician & Other Practitioners - by Geography and Service, national totals for every procedure code, data years ${years[0].dataYear}-${years[years.length - 1].dataYear}; categories from CMS's Restructured BETOS Classification System (latest assignment)`,
  datasetVintage: yearEnd(years[years.length - 1].dataYear),
});

const COMMON_LIMITATIONS = [
  "Medicare fee-for-service Part B professional services only - not Medicare Advantage, hospital facility fees, or commercial insurance.",
  "CMS publishes each data year with a lag of more than a year.",
  "For drugs, a \"service\" is a billing unit of the drug (for example, per milligram), not a visit, so drug volume swings when unit definitions or products change.",
];

async function categoryGrowthInsight(years: ServiceYearData[], rbcs: Record<string, RbcsEntry>, ctx: AgentContext): Promise<Insight | null> {
  const latestYear = years[years.length - 1];
  const priorYear = years[years.length - 2];
  const byYear = years.map((y) => rollUp(y, (code) => subcategoryOf(rbcs, code)));
  const latest = byYear[byYear.length - 1];
  const prior = byYear[byYear.length - 2];

  const rows = [...latest.entries()]
    .map(([name, cur]) => {
      const prev = prior.get(name);
      const split = prev ? splitGrowth(cur, prev) : null;
      const check = checkAgainstHistory(byYear.map((m) => m.get(name)?.medicarePayment ?? 0).filter((v) => v > 0));
      return split && prev ? { name, cur, prev, split, check } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && r.name !== "Unclassified");
  if (rows.length === 0) return null;

  const describe = (r: (typeof rows)[number]) =>
    `payment ${pct(r.split.payment)} (${money(r.prev.medicarePayment)} to ${money(r.cur.medicarePayment)}), ${splitText(r.split)}; ${historyNote(r.check, years[0].dataYear, priorYear.dataYear)}`;
  const candidates: Candidate[] = rows.map((r) => ({ id: r.name, label: r.name, summary: describe(r), primaryMetric: Math.abs(r.cur.medicarePayment - r.prev.medicarePayment) }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_CATEGORIES, taskDescription: `Medicare Part B payment growth by service category, ${priorYear.dataYear} to ${latestYear.dataYear}` },
    ctx
  );
  const byName = new Map(rows.map((r) => [r.name, r]));
  const selected = selections.map((s) => ({ row: byName.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;

  const biggest = [...rows].sort((a, b) => b.cur.medicarePayment - b.prev.medicarePayment - (a.cur.medicarePayment - a.prev.medicarePayment))[0];
  const judged = rows.filter((r) => r.check);
  const breaks = judged.filter((r) => r.check?.anomalous);
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-claims-cost-${latestYear.dataYear}-service-category-growth`,
    headline: `${biggest.name} added the most Medicare Part B payment in ${latestYear.dataYear}: ${money(biggest.prev.medicarePayment)} to ${money(biggest.cur.medicarePayment)} (${pct(biggest.split.payment)}); ${breaks.length} of ${judged.length} service categories broke from their own history.`,
    questionId: "Q011",
    signalType: breaks.length > 0 ? "anomaly" : "baseline",
    period: { start: `${priorYear.dataYear}-01-01`, end: yearEnd(latestYear.dataYear) },
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: biggest.split.payment * 100, unit: "percent", comparedTo: `${biggest.name} ${priorYear.dataYear} Medicare payment` },
    drivers: [
      {
        description: `Every procedure code's national payment and services, grouped by CMS's RBCS category and judged against each category's own yearly changes (2x median absolute deviation, 1-point floor): ${selected.map(({ row, rationale }) => `${row.name}: ${describe(row)}${source === "llm" ? ` - ${rationale}` : ""}`).join("; ")}. Candidate selection method: ${source === "llm" ? `model-reasoned salience ranking over all ${rows.length} categories` : "deterministic ranking by dollar change"}.`,
        supportingEvidenceIds: ["ev-svc-categories"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Which kinds of care are driving Medicare's cost growth - procedures, imaging, tests, drugs or visits - and whether each is more services or costlier ones. The service-level view a utilization-management or medical-cost team works from.",
    evidence: [evidenceFor(years, "ev-svc-categories")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} National totals for every code across ${years.length} years; a single year's break is an anomaly, not yet a trend.`,
    freshness: { dataAsOf: yearEnd(latestYear.dataYear), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "Categories use each code's latest RBCS assignment for every year, so a code's history stays in one category even if CMS reclassified it.",
      `Where services and payment per service swing more than ${SPLIT_SWING_LIMIT * 100}% in opposite directions, the split is marked unreliable rather than reported.`,
    ],
    nextSignal: `Watch whether the categories that broke from their history in ${latestYear.dataYear} do so again in ${latestYear.dataYear + 1}.`,
    recommendedInternalValidation: "Compare against a plan's own professional claims grouped the same way (RBCS is public, so the grouping can be reproduced exactly).",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Medicare Part B payment change by service category, ${priorYear.dataYear} to ${latestYear.dataYear}`,
      unit: "% change",
      bars: selected.map(({ row }) => ({ label: row.name, value: Math.round(row.split.payment * 1000) / 10 })),
    },
  });
}

async function codeGrowthInsight(years: ServiceYearData[], rbcs: Record<string, RbcsEntry>, ctx: AgentContext): Promise<Insight | null> {
  const latestYear = years[years.length - 1];
  const priorYear = years[years.length - 2];
  const prior = new Map(priorYear.services.map((s) => [s.code, s]));
  const latestTotal = latestYear.services.reduce((s, r) => s + r.medicarePayment, 0);
  const newCodes = latestYear.services.filter((s) => !prior.has(s.code));
  const newCodePayment = newCodes.reduce((s, r) => s + r.medicarePayment, 0);
  const priorPayment = (code: string) => prior.get(code)?.medicarePayment ?? 0;
  const emerging = latestYear.services
    .filter((s) => s.medicarePayment >= MIN_CODE_PAYMENT && priorPayment(s.code) < MIN_PRIOR_PAYMENT)
    .sort((a, b) => b.medicarePayment - a.medicarePayment);

  const rows = latestYear.services
    .filter((s) => s.medicarePayment >= MIN_CODE_PAYMENT && priorPayment(s.code) >= MIN_PRIOR_PAYMENT)
    .map((cur) => {
      const prev = prior.get(cur.code)!;
      const split = splitGrowth(cur, prev);
      return split ? { cur, prev, split, change: cur.medicarePayment - prev.medicarePayment } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return null;

  const label = (r: (typeof rows)[number]) => `${r.cur.code} ${short(r.cur.description)}`;
  const describe = (r: (typeof rows)[number]) =>
    `${subcategoryOf(rbcs, r.cur.code)}${r.cur.isDrug ? ", Part B drug" : ""}; payment ${pct(r.split.payment)} (${money(r.prev.medicarePayment)} to ${money(r.cur.medicarePayment)}), ${splitText(r.split)}`;
  const candidates: Candidate[] = rows.map((r) => ({ id: r.cur.code, label: label(r), summary: describe(r), primaryMetric: r.change }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_CODES, taskDescription: `Individual Medicare Part B services with the largest payment growth, ${priorYear.dataYear} to ${latestYear.dataYear}` },
    ctx
  );
  const byCode = new Map(rows.map((r) => [r.cur.code, r]));
  const selected = selections.map((s) => ({ row: byCode.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;

  const top = [...rows].sort((a, b) => b.change - a.change)[0];
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-claims-cost-${latestYear.dataYear}-service-code-growth`,
    headline: `${label(top)} added the most Medicare Part B payment of any established service in ${latestYear.dataYear}: ${money(top.prev.medicarePayment)} to ${money(top.cur.medicarePayment)} (${pct(top.split.payment)})${emerging.length > 0 ? `; ${emerging.length} near-new services each passed ${money(MIN_CODE_PAYMENT)}, led by ${emerging[0].code} at ${money(emerging[0].medicarePayment)}` : ""}.`,
    questionId: "Q012",
    signalType: "baseline",
    period: { start: `${priorYear.dataYear}-01-01`, end: yearEnd(latestYear.dataYear) },
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: top.change, unit: "usd", comparedTo: `${top.cur.code} ${priorYear.dataYear} Medicare payment (${money(top.prev.medicarePayment)})` },
    drivers: [
      {
        description: `Established services (at least ${money(MIN_CODE_PAYMENT)} in ${latestYear.dataYear} and ${money(MIN_PRIOR_PAYMENT)} in ${priorYear.dataYear}): ${selected.map(({ row, rationale }) => `${label(row)} (${describe(row)})${source === "llm" ? ` - ${rationale}` : ""}`).join("; ")}. Candidate selection method: ${source === "llm" ? `model-reasoned salience ranking over all ${rows.length} qualifying services` : "deterministic ranking by dollar growth"}. ${newCodes.length.toLocaleString()} codes billed in ${latestYear.dataYear} were not billed in ${priorYear.dataYear}; they account for ${money(newCodePayment)} (${((newCodePayment / latestTotal) * 100).toFixed(1)}% of payment) and can't be compared year over year. ${emerging.length} services reached at least ${money(MIN_CODE_PAYMENT)} in ${latestYear.dataYear} from under ${money(MIN_PRIOR_PAYMENT)} (or nothing) in ${priorYear.dataYear}${emerging.length > 0 ? `, led by ${emerging.slice(0, TOP_N_EMERGING).map((e) => `${e.code} ${short(e.description)} (${money(priorPayment(e.code))} to ${money(e.medicarePayment)})`).join("; ")}` : ""}.`,
        supportingEvidenceIds: ["ev-svc-codes"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "The specific services behind cost growth - the level where payers set coverage policy, prior authorization and site-of-care rules.",
    evidence: [evidenceFor(years, "ev-svc-codes")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} National totals for every code; a single year's growth is a baseline, not a trend.`,
    freshness: { dataAsOf: yearEnd(latestYear.dataYear), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "CMS adds and retires codes every year; growth that moves from a retired code to a new one shows up as a new code, not as growth.",
    ],
    nextSignal: `Watch these codes in ${latestYear.dataYear + 1} data, and any CMS rule changing their payment (the Federal Register agent tracks those).`,
    recommendedInternalValidation: "Check the same codes in a plan's own claims, where utilization-management policy can be compared directly.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Largest Medicare Part B payment growth by service, ${priorYear.dataYear} to ${latestYear.dataYear}`,
      unit: "USD change",
      bars: selected.map(({ row }) => ({ label: row.cur.code, value: Math.round(row.change) })),
    },
  });
}

function drugShareInsight(years: ServiceYearData[]): Insight | null {
  const series = years.map((y) => {
    const total = y.services.reduce((s, r) => s + r.medicarePayment, 0);
    const drugs = y.services.filter((r) => r.isDrug).reduce((s, r) => s + r.medicarePayment, 0);
    return { year: y.dataYear, total, drugs, share: total > 0 ? drugs / total : 0 };
  });
  const latest = series[series.length - 1];
  const prior = series[series.length - 2];
  const first = series[0];
  if (latest.total === 0 || first.total === 0) return null;

  const check = checkAgainstHistory(series.map((s) => s.drugs));
  const directions = series.slice(1).map((s, i) => directionOf(s.share, series[i].share));
  const persistent = meetsPersistence(directions);
  const confidence = classifyConfidence({ persistenceMet: persistent, hasFullBaseline: true, hasExternalCorroboration: false });
  const drugGrowth = latest.drugs / prior.drugs - 1;

  return validateInsight({
    id: `sig-claims-cost-${latest.year}-part-b-drug-share`,
    headline: `Part B drugs billed by practitioners were ${(latest.share * 100).toFixed(1)}% of Medicare Part B professional payment in ${latest.year} (${money(latest.drugs)}), up from ${(first.share * 100).toFixed(1)}% in ${first.year}; drug payment grew ${pct(drugGrowth)} in ${latest.year} alone.`,
    questionId: "Q012",
    signalType: check?.anomalous ? "anomaly" : persistent ? "trend" : "baseline",
    period: { start: `${first.year}-01-01`, end: yearEnd(latest.year) },
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: latest.share * 100, unit: "percent", comparedTo: `${(first.share * 100).toFixed(1)}% in ${first.year}` },
    drivers: [
      {
        description: `Payment for codes CMS flags as drugs (HCPCS_Drug_Ind), against all Part B professional payment, each year: ${series.map((s) => `${s.year}: ${(s.share * 100).toFixed(1)}% (${money(s.drugs)})`).join("; ")}. The ${latest.year} growth in drug payment ${historyNote(check, first.year, prior.year)}.`,
        supportingEvidenceIds: ["ev-svc-drugs"],
        relationship: "correlation",
      },
    ],
    businessRelevance: "Physician-administered drugs (infusions, injections, biologics) are the fastest-growing slice of Part B spending and a major target of medical-benefit drug management and site-of-care programs.",
    evidence: [evidenceFor(years, "ev-svc-drugs")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} ${series.length} years of national totals for every code.`,
    freshness: { dataAsOf: yearEnd(latest.year), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "Covers drugs billed by practitioners under Part B, not Part D pharmacy drugs or drugs billed by hospital outpatient departments.",
      "Uses CMS's drug indicator, which includes some biologic products such as skin substitutes.",
    ],
    nextSignal: `Watch whether the drug share keeps rising in ${latest.year + 1} data, and CMS rules on Part B drug payment (inflation rebates, skin substitute payment reform).`,
    recommendedInternalValidation: "Compare against the medical-benefit drug share of a plan's own professional spend.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: {
      label: "Part B drugs as a share of Part B professional payment",
      unit: "percent",
      points: series.map((s) => ({ date: yearEnd(s.year), value: Math.round(s.share * 1000) / 10 })),
    },
  });
}

/** All service-level insights, or none when fewer than 2 data years are on disk. */
export async function buildServiceTrendInsights(years: ServiceYearData[], ctx: AgentContext, rbcs: Record<string, RbcsEntry> = loadRbcsMap()): Promise<Insight[]> {
  if (years.length < 2) return [];
  const insights = [await categoryGrowthInsight(years, rbcs, ctx), await codeGrowthInsight(years, rbcs, ctx), drugShareInsight(years)];
  return insights.filter((i): i is Insight => i !== null);
}
