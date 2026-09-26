/**
 * Health-care private offering insights (Q163-Q165) from SEC's quarterly
 * Form D data sets (data/adapters/secFormD.ts), added 2026-09-25. An
 * offering is counted once, in the quarter of its original notice, with
 * the amount sold from its latest amendment in the window; amendments to
 * offerings from before the window are left out, so nothing is counted
 * twice.
 *
 * Wording: "private offering" or "raise", never "venture round". Form D
 * also covers private placements by listed companies, debt and other
 * exempt offerings, and the industry group is the issuer's own pick.
 */
import { loadLatestSnapshot, SOURCE_ID, type FormDSnapshot } from "../../data/adapters/secFormD";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence } from "../../intelligence/trends/trend";
import type { AgentContext } from "../types";

const AGENT_ID = "market-catalyst-intelligence";
const NATIONAL_GEO = { level: "national" as const, code: "US", label: "United States" };
const TOP_N_OFFERINGS = 10;
const TOP_N_STATES = 10;
const DATA_SETS_URL = "https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets";

const billions = (usd: number) => `$${(usd / 1e9).toFixed(2)}B`;
const millions = (usd: number) => `$${(usd / 1e6).toFixed(1)}M`;
const share = (part: number, whole: number) => `${((part / whole) * 100).toFixed(0)}%`;
/** "2026Q2" -> "Q2 2026" */
const quarterLabel = (q: string) => `Q${q.slice(5)} ${q.slice(0, 4)}`;
/** "NEW YORK" -> "New York" */
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

function baselineConfidence() {
  return classifyConfidence({ persistenceMet: false, hasFullBaseline: false, hasExternalCorroboration: false });
}

function windowText(snapshot: FormDSnapshot): string {
  return `${quarterLabel(snapshot.quarters[0])} to ${quarterLabel(snapshot.quarters[snapshot.quarters.length - 1])}`;
}

function commonLimitations(snapshot: FormDSnapshot): string[] {
  return [
    "Form D covers exempt offerings of every kind: venture and growth rounds, but also private placements by listed companies, debt and other securities. It is a notice, not a record of a closed round.",
    "Health care is the five health industry groups on the form (biotechnology, pharmaceuticals, health insurance, hospitals and physicians, other health care), as each issuer chose them. Health-focused investment funds file as pooled investment funds and are not included.",
    `Amounts sold are as the issuer reported them. An offering counts once, in the quarter of its first notice, at the amount sold in its latest amendment; ${snapshot.counts.amendmentsToEarlierOfferings.toLocaleString()} amendments to offerings first reported before the window are left out.`,
    "Offerings with nothing sold yet count as $0, and issuers can report late, so the latest quarter may rise when amendments arrive.",
  ];
}

function evidence(snapshot: FormDSnapshot, id: string, url?: string) {
  return {
    id,
    sourceId: SOURCE_ID,
    description: `SEC Form D data sets, ${snapshot.quarters.length} quarterly files (${windowText(snapshot)}), ${snapshot.counts.healthFilings.toLocaleString()} health-care notices and amendments, summarized at pull time`,
    datasetVintage: snapshot.pulledAt.slice(0, 10),
    url: url ?? DATA_SETS_URL,
  };
}

function totalsInsight(snapshot: FormDSnapshot): Insight | null {
  const rows = snapshot.byQuarterIndustry;
  if (rows.length === 0) return null;
  const stamp = snapshot.pulledAt.slice(0, 10);
  const offerings = snapshot.counts.offerings;
  const total = rows.reduce((s, r) => s + r.amountSold, 0);
  const byIndustry = new Map<string, { offerings: number; amountSold: number }>();
  const byQuarter = new Map<string, { offerings: number; amountSold: number }>();
  for (const r of rows) {
    for (const [map, key] of [[byIndustry, r.industry], [byQuarter, r.quarter]] as const) {
      const t = map.get(key) ?? { offerings: 0, amountSold: 0 };
      t.offerings += r.offerings;
      t.amountSold += r.amountSold;
      map.set(key, t);
    }
  }
  const industries = Array.from(byIndustry, ([industry, t]) => ({ industry, ...t })).sort((a, b) => b.amountSold - a.amountSold);
  const latestQ = snapshot.quarters[snapshot.quarters.length - 1];
  const yearAgoQ = `${Number(latestQ.slice(0, 4)) - 1}${latestQ.slice(4)}`;
  const latest = byQuarter.get(latestQ);
  const yearAgo = byQuarter.get(yearAgoQ);
  const comparison =
    latest && yearAgo
      ? `; ${quarterLabel(latestQ)} had ${latest.offerings.toLocaleString()} offerings and ${billions(latest.amountSold)} sold, against ${yearAgo.offerings.toLocaleString()} and ${billions(yearAgo.amountSold)} in ${quarterLabel(yearAgoQ)}`
      : "";
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-formd-health-raises`,
    headline: `Health-care companies reported ${offerings.toLocaleString()} new private offerings on Form D from ${windowText(snapshot)}, with ${billions(total)} sold; ${industries[0].industry.toLowerCase()} issuers accounted for ${billions(industries[0].amountSold)} (${share(industries[0].amountSold, total)})${comparison}.`,
    questionId: "Q163",
    signalType: "structural-change",
    period: { start: snapshot.windowStart, end: snapshot.windowEnd },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: total, unit: "usd", comparedTo: `${offerings.toLocaleString()} new offerings` },
    drivers: [
      {
        description: `New offerings and amount sold by industry group: ${industries.map((i) => `${i.industry}: ${i.offerings.toLocaleString()} offerings, ${billions(i.amountSold)}`).join("; ")}. By quarter: ${snapshot.quarters.map((q) => `${quarterLabel(q)}: ${(byQuarter.get(q)?.offerings ?? 0).toLocaleString()} offerings, ${billions(byQuarter.get(q)?.amountSold ?? 0)}`).join("; ")}.`,
        supportingEvidenceIds: ["ev-formd-health-raises"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Private capital flowing into health-care companies before they are public or between public offerings: the funding behind the next wave of drugs, devices and care-delivery competitors a plan or provider will meet.",
    evidence: [evidence(snapshot, "ev-formd-health-raises")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Eight quarters of full-population notices; a quarter-to-quarter swing counts as a trend only once it holds across later quarters.`,
    freshness: { dataAsOf: snapshot.windowEnd, generatedAt: new Date().toISOString(), isStale: false },
    limitations: commonLimitations(snapshot),
    nextSignal: "Watch the next quarterly file, and compare each quarter with the same quarter a year earlier rather than the one before.",
    recommendedInternalValidation: "Not applicable — this is public aggregate filing data.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: {
      label: "Health-care Form D amount sold by quarter",
      unit: "USD",
      points: snapshot.quarters.map((q) => ({ date: `${q.slice(0, 4)}-${String(Number(q.slice(5)) * 3 - 2).padStart(2, "0")}-01`, value: Math.round(byQuarter.get(q)?.amountSold ?? 0) })),
    },
    chart: {
      type: "donut",
      title: `Health-care Form D amount sold by industry group, ${windowText(snapshot)}`,
      unit: "usd",
      slices: industries.map((i) => ({ label: i.industry, value: Math.round(i.amountSold) })),
    },
  };
  return validateInsight(insight);
}

async function largestOfferingsInsight(snapshot: FormDSnapshot, ctx: AgentContext): Promise<Insight | null> {
  const top = snapshot.topOfferings;
  if (top.length === 0) return null;
  const stamp = snapshot.pulledAt.slice(0, 10);
  const candidates: Candidate[] = top.map((o) => ({
    id: o.accessionNumber,
    label: o.entity,
    summary: `${millions(o.amountSold ?? 0)} sold by ${o.entity} (${o.industry}, ${titleCase(o.state)}), first notice ${o.filingDate}${o.amendments ? `, ${o.amendments} amendment${o.amendments === 1 ? "" : "s"}` : ""}`,
    primaryMetric: o.amountSold ?? 0,
  }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_OFFERINGS, taskDescription: "largest health-care private offerings reported on Form D this window, by amount sold" },
    ctx
  );
  if (selections.length === 0) return null;
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const selected = selections.map((s) => ({ selection: s, candidate: byId.get(s.candidateId)! })).filter((x) => x.candidate);
  const largest = top[0];
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-formd-health-largest-raises`,
    headline: `The largest health-care private offering reported on Form D from ${windowText(snapshot)} was by ${largest.entity} (${largest.industry}, ${titleCase(largest.state)}): ${millions(largest.amountSold ?? 0)} sold, first notice filed ${largest.filingDate}.`,
    questionId: "Q164",
    signalType: "structural-change",
    period: { start: snapshot.windowStart, end: snapshot.windowEnd },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: largest.amountSold ?? 0, unit: "usd", comparedTo: `${snapshot.counts.offerings.toLocaleString()} health-care offerings in the window` },
    drivers: [
      {
        description: `Largest offerings by amount sold: ${selected.map(({ selection, candidate }) => `${candidate.summary}${source === "llm" ? ` — ${selection.rationale}` : ""}`).join("; ")}. Candidate selection method: ${source === "llm" ? `model-reasoned salience ranking over the ${candidates.length} largest offerings` : "deterministic top-N by amount sold"}.`,
        supportingEvidenceIds: ["ev-formd-health-largest-raises"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "The biggest private bets on health-care companies, named from their own SEC notices: well-funded entrants and expanding competitors worth knowing before they show up in a network, formulary or bid.",
    evidence: [evidence(snapshot, "ev-formd-health-largest-raises", largest.url)],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Named from the issuers' own notices; amounts are as reported and not independently checked.`,
    freshness: { dataAsOf: snapshot.windowEnd, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [...commonLimitations(snapshot), "Naming an issuer reports its own filing; it is not an assessment of the company."],
    nextSignal: "Watch for amendments that raise these amounts and for new large notices in the next quarterly file.",
    recommendedInternalValidation: "Open the linked SEC filing before relying on an amount; the notice shows the offering type and exemption claimed.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Largest health-care private offerings by amount sold (Form D), ${windowText(snapshot)}`,
      unit: "usd",
      bars: selected.map(({ candidate }) => ({ label: candidate.label, value: candidate.primaryMetric })),
    },
  };
  return validateInsight(insight);
}

async function byStateInsight(snapshot: FormDSnapshot, ctx: AgentContext): Promise<Insight | null> {
  const states = snapshot.byState.filter((s) => s.state !== "Not reported");
  if (states.length === 0) return null;
  const stamp = snapshot.pulledAt.slice(0, 10);
  const total = snapshot.byState.reduce((s, r) => s + r.amountSold, 0);
  const candidates: Candidate[] = states.map((s) => ({
    id: s.state,
    label: titleCase(s.state),
    summary: `${billions(s.amountSold)} sold across ${s.offerings.toLocaleString()} offerings (${share(s.amountSold, total)} of ${billions(total)})`,
    primaryMetric: s.amountSold,
  }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_STATES, taskDescription: "health-care Form D amount sold by the issuer's state or country this window" },
    ctx
  );
  if (selections.length === 0) return null;
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const selected = selections.map((s) => ({ selection: s, candidate: byId.get(s.candidateId)! })).filter((x) => x.candidate);
  const leader = states[0];
  const confidence = baselineConfidence();

  const insight: Insight = {
    id: `sig-market-catalyst-${stamp}-formd-health-by-state`,
    headline: `Issuers based in ${titleCase(leader.state)} reported the most health-care private offering dollars on Form D from ${windowText(snapshot)}: ${billions(leader.amountSold)} across ${leader.offerings.toLocaleString()} offerings, ${share(leader.amountSold, total)} of ${billions(total)}.`,
    questionId: "Q165",
    signalType: "structural-change",
    period: { start: snapshot.windowStart, end: snapshot.windowEnd },
    population: "n/a",
    geography: NATIONAL_GEO,
    magnitude: { value: leader.amountSold, unit: "usd", comparedTo: `all health-care Form D amount sold (${billions(total)})`, deltaPercent: (leader.amountSold / total) * 100 },
    drivers: [
      {
        description: `Amount sold by the primary issuer's state or country: ${selected.map(({ selection, candidate }) => `${candidate.label}: ${candidate.summary}${source === "llm" ? ` — ${selection.rationale}` : ""}`).join("; ")}. Candidate selection method: ${source === "llm" ? `model-reasoned salience ranking over ${candidates.length} states and countries` : "deterministic top-N by amount sold"}.`,
        supportingEvidenceIds: ["ev-formd-health-by-state"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Where private health-care capital is concentrating: the clusters most likely to produce new therapies, devices and care-delivery companies, and where new competitors and partners are forming.",
    evidence: [evidence(snapshot, "ev-formd-health-by-state")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Full-population totals over eight quarters; a single large offering can move a smaller state's rank.`,
    freshness: { dataAsOf: snapshot.windowEnd, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [...commonLimitations(snapshot), "Located by the primary issuer's principal place of business as filed, not where the money is spent."],
    nextSignal: "Watch whether the leading states hold their share in the next quarterly files.",
    recommendedInternalValidation: "Not applicable — this is public aggregate filing data.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Health-care Form D amount sold by issuer state, ${windowText(snapshot)}`,
      unit: "usd",
      bars: selected.map(({ candidate }) => ({ label: candidate.label, value: Math.round(candidate.primaryMetric) })),
    },
  };
  return validateInsight(insight);
}

export async function buildFormDInsights(ctx: AgentContext): Promise<Insight[]> {
  const snapshot = loadLatestSnapshot();
  if (!snapshot || snapshot.counts.offerings === 0) return [];
  const out: Insight[] = [];
  const totals = totalsInsight(snapshot);
  if (totals) out.push(totals);
  const largest = await largestOfferingsInsight(snapshot, ctx);
  if (largest) out.push(largest);
  const byState = await byStateInsight(snapshot, ctx);
  if (byState) out.push(byState);
  return out;
}
