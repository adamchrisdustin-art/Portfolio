/**
 * Facility capacity insights from CMS's Provider of Services files
 * (data/adapters/providerOfServices.ts). Added 2026-09-25 to replace the
 * hospital-count proxy (one Hospital General Information snapshot) with
 * certified beds and a 2011-onward history.
 *
 * Trends compare fourth-quarter files, the only quarter CMS published
 * before 2018, and skip quarters the adapter marks unusable (frozen or
 * defective files). Each facility type is counted from one of CMS's two
 * POS files per quarter, never both, so the move of nursing homes, home
 * health, hospice and surgery centers to the newer file isn't a jump.
 */
import {
  annualSeries,
  combinedHistory,
  eventsFor,
  FACILITY_TYPE_LABELS,
  FACILITY_TYPES,
  loadAllQuarters,
  SOURCE_ID,
  unusableQuarters,
  type AnnualPoint,
  type CombinedQuarter,
  type FacilityType,
} from "../../data/adapters/providerOfServices";
import { STATE_CODES } from "../../data/sources/states";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence, directionOf, meetsPersistence } from "../../intelligence/trends/trend";
import type { AgentContext } from "../types";

const AGENT_ID = "market-growth-geographic-intelligence";
const LOOKBACK_YEARS = 10;
/** Facility counts are compared against 2019, before pandemic-era temporary hospital sites opened (2020) and closed (2023). */
const PRE_PANDEMIC_YEAR = 2019;
const CHART_TOP_N_STATES = 8;
const MIN_BEDS_FOR_STATE = 1000; // a small state's % change on a few hundred beds is noise
const HOSPITAL_TYPES: FacilityType[] = ["short-term-acute-hospital", "critical-access-hospital", "other-hospital"];
const POS_URL = "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/provider-of-services-file-quality-improvement-and-evaluation-system";

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const n = (x: number) => x.toLocaleString("en-US");
const round1 = (x: number) => Math.round(x * 1000) / 10;

const COMMON_LIMITATIONS = [
  "Certified beds are the beds in Medicare- or Medicaid-certified areas of a facility, not staffed or occupied beds.",
  "Counts only facilities active in each file; a facility that changes owner keeps its certification number and isn't counted as a closure and an opening.",
  "No population figures are used, so this shows where capacity changed, not whether it kept up with demand.",
];

interface Loaded {
  history: CombinedQuarter[];
  latest: CombinedQuarter;
}

function load(): Loaded | null {
  const history = combinedHistory(loadAllQuarters());
  if (history.length === 0) return null;
  return { history, latest: history[history.length - 1] };
}

/** Beds per state summed across several facility types, for years where every type is usable. */
function summedAnnual(history: CombinedQuarter[], types: FacilityType[]): { year: number; periodEnd: string; beds: number; byState: Map<string, number> }[] {
  const perType = types.map((t) => new Map(annualSeries(history, t).map((p) => [p.year, p])));
  const years = [...perType[0].keys()].filter((y) => perType.every((m) => m.has(y)));
  return years.map((year) => {
    const points = perType.map((m) => m.get(year)!) as AnnualPoint[];
    const byState = new Map<string, number>();
    for (const p of points) for (const [state, v] of p.byState) byState.set(state, (byState.get(state) ?? 0) + v.beds);
    return { year, periodEnd: points[0].periodEnd, beds: points.reduce((s, p) => s + p.beds, 0), byState };
  });
}

/** The newest quarter usable for every type given, when it's newer than the last fourth quarter. */
function latestQuarterFor(loaded: Loaded, types: FacilityType[]): { quarter: string; periodEnd: string; beds: number } | null {
  const q = loaded.latest;
  if (q.quarter.endsWith("-Q4") || types.some((t) => !q.types.has(t) || unusableQuarters(loaded.history, t).has(q.quarter))) return null;
  return { quarter: q.quarter, periodEnd: q.periodEnd, beds: types.reduce((s, t) => s + q.types.get(t)!.beds, 0) };
}

/** How much a type's beds moved in the quarter it switched CMS systems, against its typical quarterly move, so the seam is shown rather than asserted. */
function systemSwitchNote(history: CombinedQuarter[], type: FacilityType, what: string): string | null {
  const bad = unusableQuarters(history, type);
  const points = history.filter((q) => q.types.has(type) && !bad.has(q.quarter)).map((q) => ({ quarter: q.quarter, t: q.types.get(type)! }));
  const moves = points.slice(1).map((p, i) => ({ quarter: p.quarter, change: p.t.beds / points[i].t.beds - 1, switched: p.t.system !== points[i].t.system }));
  const seam = moves.find((m) => m.switched);
  if (!seam) return null;
  const typical = moves.filter((m) => !m.switched).slice(-8).map((m) => Math.abs(m.change)).sort((a, b) => a - b);
  const median = typical[Math.floor(typical.length / 2)] ?? 0;
  return `Certified ${what} beds moved to CMS's newer survey system in ${seam.quarter}; beds changed ${pct(seam.change)} that quarter, against a typical quarterly move of ${(median * 100).toFixed(2)}% over the prior two years.`;
}

/** Chart labels short enough for a bar axis. */
const SHORT_LABELS: Record<FacilityType, string> = {
  "short-term-acute-hospital": "Short-term acute hospitals",
  "critical-access-hospital": "Critical access hospitals",
  "other-hospital": "Other hospitals",
  "nursing-home": "Nursing homes",
  "home-health-agency": "Home health agencies",
  hospice: "Hospices",
  "ambulatory-surgical-center": "Surgery centers",
  "esrd-facility": "Dialysis facilities",
  "icf-iid": "ICF/IID facilities",
  "rural-health-clinic": "Rural health clinics",
  fqhc: "FQHCs",
};

const evidence = (id: string, description: string, vintage: string) => ({ id, sourceId: SOURCE_ID, description, datasetVintage: vintage, url: POS_URL });

interface StateChange {
  state: string;
  start: number;
  end: number;
  growth: number;
}

function stateChanges(start: Map<string, number>, end: Map<string, number>): StateChange[] {
  return [...end]
    .filter(([state, v]) => STATE_CODES.has(state) && (start.get(state) ?? 0) >= MIN_BEDS_FOR_STATE && v > 0)
    .map(([state, v]) => ({ state, start: start.get(state)!, end: v, growth: v / start.get(state)! - 1 }));
}

async function bedsByStateInsight(
  loaded: Loaded,
  ctx: AgentContext,
  spec: { types: FacilityType[]; stem: string; questionId: string; what: string; direction: "highest" | "lowest"; businessRelevance: string; extraLimitations: string[]; extraDriver?: (first: number, last: number) => string }
): Promise<Insight | null> {
  const annual = summedAnnual(loaded.history, spec.types);
  if (annual.length < 3) return null;
  const last = annual[annual.length - 1];
  const base = annual.find((a) => a.year === last.year - LOOKBACK_YEARS) ?? annual[0];
  const rows = stateChanges(base.byState, last.byState);
  if (rows.length === 0) return null;
  const growth = last.beds / base.beds - 1;
  const recent = latestQuarterFor(loaded, spec.types);
  const directions = annual.slice(-3).map((a, i, arr) => (i === 0 ? null : directionOf(a.beds, arr[i - 1].beds))).filter((d) => d !== null);
  const persistent = meetsPersistence(directions);
  const confidence = classifyConfidence({ persistenceMet: persistent, hasFullBaseline: true, hasExternalCorroboration: false });

  const ranked = [...rows].sort((a, b) => b.growth - a.growth);
  const describe = (r: StateChange) => `${n(r.start)} to ${n(r.end)} certified ${spec.what} beds (${pct(r.growth)})`;
  const candidates: Candidate[] = rows.map((r) => ({ id: r.state, label: r.state, summary: describe(r), primaryMetric: r.growth }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: CHART_TOP_N_STATES, taskDescription: `certified ${spec.what} bed change by state, ${base.year} to ${last.year}`, direction: spec.direction },
    ctx
  );
  const byState = new Map(rows.map((r) => [r.state, r]));
  const selected = selections.map((s) => ({ row: byState.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;

  const grew = rows.filter((r) => r.growth > 0).length;
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const end = recent?.periodEnd ?? last.periodEnd;
  const series = [...annual.filter((a) => a.year >= base.year).map((a) => ({ date: a.periodEnd, value: a.beds })), ...(recent ? [{ date: recent.periodEnd, value: recent.beds }] : [])];

  return validateInsight({
    id: `sig-market-growth-${end}-${spec.stem}`,
    headline: `Certified ${spec.what} beds ${growth < 0 ? "fell" : "rose"} ${pct(Math.abs(growth)).slice(1)} nationally from ${base.year} to ${last.year}, to ${n(last.beds)}; ${grew} of ${rows.length} states added beds, with the biggest gain in ${top.state} (${pct(top.growth)}) and the biggest drop in ${bottom.state} (${pct(bottom.growth)}).`,
    questionId: spec.questionId,
    signalType: persistent ? "trend" : "baseline",
    period: { start: `${base.year}-10-01`, end },
    population: "cross-population",
    geography: { level: "state", code: "US-STATES", label: `${rows.length} states and DC with at least ${n(MIN_BEDS_FOR_STATE)} certified ${spec.what} beds in ${base.year}` },
    magnitude: { value: round1(growth), unit: "percent", comparedTo: `certified ${spec.what} beds in the fourth quarter of ${base.year}`, delta: last.beds - base.beds },
    drivers: [
      {
        description: `National certified ${spec.what} beds, fourth quarter of each year: ${annual
          .filter((a) => a.year >= base.year)
          .map((a) => `${a.year} ${n(a.beds)}`)
          .join(", ")}${recent ? `; ${recent.quarter} ${n(recent.beds)}` : ""}. By state, ${base.year} to ${last.year}: ${selected
          .map(({ row, rationale }) => `${row.state}: ${describe(row)}${source === "llm" ? ` - ${rationale}` : ""}`)
          .join("; ")}.${spec.extraDriver ? ` ${spec.extraDriver(base.year, last.year)}` : ""}${source === "llm" ? ` States shown were chosen by model-reasoned salience ranking over all ${rows.length}.` : ""}`,
        supportingEvidenceIds: ["ev-pos-beds"],
        relationship: "correlation",
      },
    ],
    businessRelevance: spec.businessRelevance,
    evidence: [evidence("ev-pos-beds", `CMS Provider of Services files, every certified ${spec.what} facility, fourth quarter ${base.year} through ${recent?.quarter ?? `${last.year}-Q4`}`, end)],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} ${last.year - base.year} years of fourth-quarter files; a single public source.`,
    freshness: { dataAsOf: end, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [...COMMON_LIMITATIONS, ...spec.extraLimitations],
    nextSignal: "CMS publishes the next quarter's file about a month after the quarter ends; watch whether the states at either end keep moving the same way.",
    recommendedInternalValidation: "Compare against a plan's own contracted facility network and admissions by state.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: { label: `National certified ${spec.what} beds`, unit: "beds", points: series },
    chart: {
      type: "bar",
      title: source === "llm" ? `Certified ${spec.what} bed change, ${base.year}-${last.year}, ${selected.length} states selected as most noteworthy` : `Certified ${spec.what} bed change by state, ${base.year}-${last.year}`,
      unit: "% change",
      bars: selected.map(({ row }) => ({ label: row.state, value: round1(row.growth) })).sort((a, b) => (spec.direction === "lowest" ? a.value - b.value : b.value - a.value)),
    },
  });
}

function facilityTypeInsight(loaded: Loaded): Insight | null {
  const rows = FACILITY_TYPES.flatMap((type) => {
    const series = annualSeries(loaded.history, type);
    const base = series.find((p) => p.year === PRE_PANDEMIC_YEAR);
    const last = series[series.length - 1];
    if (!base || !last || last.year <= base.year) return [];
    return [{ type, base, last, growth: last.providers / base.providers - 1 }];
  });
  if (rows.length === 0) return null;
  const latestYear = Math.max(...rows.map((r) => r.last.year));
  const asOf = loaded.latest.quarter;
  const priorAsOf = `${Number(asOf.slice(0, 4)) - 1}${asOf.slice(4)}`;
  const events = FACILITY_TYPES.flatMap((type) => {
    const now = eventsFor(loaded.history, type, latestYear, asOf);
    const then = eventsFor(loaded.history, type, latestYear - 1, priorAsOf);
    return now && then ? [{ type, now, then }] : [];
  });
  const ranked = [...rows].sort((a, b) => b.growth - a.growth);
  const shrinking = ranked.filter((r) => r.growth < 0);
  const label = (t: FacilityType) => FACILITY_TYPE_LABELS[t];
  const lower = (t: FacilityType) => (t === "icf-iid" ? "intellectual disability (ICF/IID) facilities" : label(t).charAt(0).toLowerCase() + label(t).slice(1));
  const nh = events.find((e) => e.type === "nursing-home");
  const end = loaded.latest.periodEnd;

  return validateInsight({
    id: `sig-market-growth-${end}-facility-count-by-type`,
    headline: `Since ${PRE_PANDEMIC_YEAR}, ${lower(ranked[0].type)} grew fastest (${pct(ranked[0].growth)}, to ${n(ranked[0].last.providers)})${ranked[1] ? ` and ${lower(ranked[1].type)} next (${pct(ranked[1].growth)})` : ""}${shrinking.length ? `, while ${shrinking.length} of ${rows.length} facility types shrank, most of all ${lower(shrinking[shrinking.length - 1].type)} (${pct(shrinking[shrinking.length - 1].growth)})` : ""}.`,
    questionId: "Q006",
    signalType: "trend",
    period: { start: `${PRE_PANDEMIC_YEAR}-10-01`, end },
    population: "cross-population",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: round1(ranked[0].growth), unit: "percent", comparedTo: `${lower(ranked[0].type)} active in the fourth quarter of ${PRE_PANDEMIC_YEAR}` },
    drivers: [
      {
        description: `Active certified facilities, fourth quarter ${PRE_PANDEMIC_YEAR} to ${latestYear}: ${ranked.map((r) => `${label(r.type)} ${n(r.base.providers)} to ${n(r.last.providers)} (${pct(r.growth)})`).join("; ")}.`,
        supportingEvidenceIds: ["ev-pos-types"],
        relationship: "correlation",
      },
      ...(events.length
        ? [
            {
              description: `Openings and closures dated in ${latestYear}, as recorded by ${asOf}, against ${latestYear - 1} as recorded one year earlier (${priorAsOf}): ${events
                .map((e) => `${label(e.type)} ${n(e.now.openings)} opened and ${n(e.now.closures)} closed (${latestYear - 1}: ${n(e.then.openings)} and ${n(e.then.closures)})`)
                .join("; ")}.${nh ? ` Nursing home closures recorded as a voluntary merger or closure in ${latestYear}: ${n(nh.now.closuresByReason["01"] ?? 0)} of ${n(nh.now.closures)}.` : ""}`,
              supportingEvidenceIds: ["ev-pos-types"],
              relationship: "correlation" as const,
            },
          ]
        : []),
    ],
    businessRelevance:
      "Shows which care settings are adding sites and which are consolidating: growth in community clinics and outpatient surgery, and shrinking nursing home and inpatient hospital counts, shift where members can get care and where plans need network coverage.",
    evidence: [evidence("ev-pos-types", `CMS Provider of Services files (both CMS survey systems), fourth quarter ${PRE_PANDEMIC_YEAR} to ${latestYear}, plus dated openings and closures in the ${asOf} and ${priorAsOf} files`, end)],
    contradictoryEvidence: [],
    confidence: "medium",
    confidenceRationale: `Every certified facility in each file, compared across ${latestYear - PRE_PANDEMIC_YEAR} years; a single public source with no independent corroboration.`,
    freshness: { dataAsOf: end, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Compared against ${PRE_PANDEMIC_YEAR}: short-term hospital counts rose in 2020 as temporary pandemic sites were certified and fell in 2023 when they closed, so a later starting year would overstate hospital decline.`,
      "Several facility types moved from CMS's older survey system to the newer one between late 2023 and 2026; each year counts a type from one system only, and the older system's home health and surgery center counts stopped updating in 2022-2023 and are skipped.",
      "Closures keep being recorded for months after they happen, so the latest year is compared only with the prior year as it was recorded at the same point a year earlier.",
      "Counts facilities, not capacity within them: a home health agency or surgery center can be any size.",
    ],
    nextSignal: `Watch whether ${latestYear + 1}'s openings and closures, as recorded a year from now, keep the same direction for nursing homes and hospices.`,
    recommendedInternalValidation: "Compare against a plan's own network by facility type, especially where its members rely on nursing homes or hospices that are closing.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Change in active certified facilities by type, ${PRE_PANDEMIC_YEAR}-${latestYear}`,
      unit: "% change",
      bars: ranked.map((r) => ({ label: SHORT_LABELS[r.type], value: round1(r.growth) })),
    },
  });
}

export async function buildCapacityInsights(ctx: AgentContext): Promise<Insight[]> {
  const loaded = load();
  if (!loaded) return [];
  const out: Insight[] = [];
  const hospitalBeds = await bedsByStateInsight(loaded, ctx, {
    types: HOSPITAL_TYPES,
    stem: "hospital-beds-by-state",
    questionId: "Q001",
    what: "hospital",
    direction: "highest",
    businessRelevance: "Certified hospital beds are the inpatient capacity plans contract for; states adding beds are where hospital supply is growing, and states losing them are where access and negotiating leverage may shift.",
    extraLimitations: ["Hospital beds combine short-term acute, critical access, psychiatric, rehabilitation, long-term care and children's hospitals."],
    extraDriver: (first, last) => {
      const parts = HOSPITAL_TYPES.map((t) => {
        const s = annualSeries(loaded.history, t);
        const a = s.find((p) => p.year === first);
        const b = s.find((p) => p.year === last);
        return a && b ? `${FACILITY_TYPE_LABELS[t]} ${n(a.beds)} to ${n(b.beds)} (${pct(b.beds / a.beds - 1)})` : null;
      }).filter(Boolean);
      return `By hospital type: ${parts.join("; ")}.`;
    },
  });
  if (hospitalBeds) out.push(hospitalBeds);
  const types = facilityTypeInsight(loaded);
  if (types) out.push(types);
  const nursingBeds = await bedsByStateInsight(loaded, ctx, {
    types: ["nursing-home"],
    stem: "nursing-home-beds-by-state",
    questionId: "Q006",
    what: "nursing home",
    direction: "lowest",
    businessRelevance: "Nursing home beds are post-acute and long-term care capacity for Medicare, Medicaid and dual-eligible members; where beds are shrinking, discharge options narrow and plans may need other post-acute settings.",
    extraLimitations: [systemSwitchNote(loaded.history, "nursing-home", "nursing home")].filter((x): x is string => x !== null),
  });
  if (nursingBeds) out.push(nursingBeds);
  return out;
}
