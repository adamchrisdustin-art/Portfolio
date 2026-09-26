/**
 * Facility payment exposure from CMS's three inpatient pay-for-performance
 * programs (data/adapters/hospitalPenaltyPrograms.ts), joined by CCN to
 * Hospital General Information for ownership. Added 2026-09-25.
 *
 * Combined adjustment: HRRP factor x HVBP factor x 0.99 when the HAC cut
 * applies. That is how the three stack on a hospital's base operating
 * payment (the HAC cut technically applies after the other two, which the
 * multiplication already reflects). A hospital outside HVBP counts as 1
 * for it. The cohort is hospitals with an HRRP factor, i.e. the
 * inpatient-payment hospitals the programs apply to; Maryland is not in
 * it, since its hospitals are paid under its own model.
 */
import { SOURCE_ID as HOSPITAL_SOURCE_ID, loadLatestSnapshot } from "../../data/adapters/hospitalGeneralInformation";
import { DATASET_IDS, loadLatestPenaltyYear, SOURCE_ID as PENALTY_SOURCE_ID, type HospitalPenaltyRow, type HospitalPenaltyYear } from "../../data/adapters/hospitalPenaltyPrograms";
import type { EvidenceRef, Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence } from "../../intelligence/trends/trend";
import type { AgentContext } from "../types";

const AGENT_ID = "reimbursement-payment-intelligence";
const HAC_CUT = 0.99;
const TOP_N_STATES = 8;
/** A state average over fewer hospitals swings on one or two of them. */
const MIN_HOSPITALS_PER_STATE = 10;
/** Ownership groups smaller than this are left off the chart. */
const MIN_HOSPITALS_PER_OWNERSHIP = 20;

/** CMS's HRRP measure names, READM-30-{code}-HRRP, as plain conditions. */
const CONDITION_NAMES: Record<string, string> = {
  AMI: "heart attack",
  HF: "heart failure",
  PN: "pneumonia",
  COPD: "COPD",
  CABG: "bypass surgery",
  "HIP-KNEE": "hip or knee replacement",
};

const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;
const pctSigned = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`;

export function combinedAdjustment(h: HospitalPenaltyRow): number {
  return (h.hrrpFactor ?? 1) * (h.hvbpFactor ?? 1) * (h.hacPenalty ? HAC_CUT : 1);
}

/** Hospitals the programs apply to: those with an HRRP payment adjustment factor. Exported for tests. */
export function programCohort(year: HospitalPenaltyYear): HospitalPenaltyRow[] {
  return year.hospitals.filter((h) => h.hrrpFactor !== null);
}

const fyPeriod = (fy: number) => ({ start: `${fy - 1}-10-01`, end: `${fy}-09-30` });

function penaltyEvidence(year: HospitalPenaltyYear, id: string): EvidenceRef[] {
  const refs: EvidenceRef[] = [
    {
      id,
      sourceId: PENALTY_SOURCE_ID,
      description: `CMS Provider Data Catalog, FY${year.fiscalYear}: Hospital Readmissions Reduction Program, HAC Reduction Program and Hospital Value-Based Purchasing Total Performance Score, one row per hospital`,
      datasetVintage: year.datasetModified.hac,
      url: `https://data.cms.gov/provider-data/dataset/${DATASET_IDS.hac}`,
    },
  ];
  if (year.table15Url) {
    refs.push({ id: `${id}-t15`, sourceId: PENALTY_SOURCE_ID, description: `FY${year.fiscalYear} inpatient final rule, Table 15: readmissions payment adjustment factors by hospital`, datasetVintage: `${year.fiscalYear - 1}-10-01`, url: year.table15Url });
  }
  if (year.table16bUrl) {
    refs.push({ id: `${id}-t16b`, sourceId: PENALTY_SOURCE_ID, description: `FY${year.fiscalYear} inpatient final rule, Table 16B: actual value-based purchasing adjustment factors by hospital`, datasetVintage: `${year.fiscalYear - 1}-10-01`, url: year.table16bUrl });
  }
  return refs;
}

const COMMON_LIMITATIONS = [
  "Adjustments apply to base inpatient operating payments, not a hospital's total revenue; without each hospital's Medicare inpatient volume here, dollar amounts are not estimated and every hospital counts equally.",
  "Scores reflect performance periods one to three years before the payment year.",
];

function facilityExposureInsight(year: HospitalPenaltyYear, cohort: HospitalPenaltyRow[]): Insight | null {
  if (cohort.length === 0) return null;
  const hrrpCut = cohort.filter((h) => (h.hrrpFactor ?? 1) < 1);
  const hacScored = year.hospitals.filter((h) => h.hacPenalty !== null);
  const hacCut = hacScored.filter((h) => h.hacPenalty);
  const vbp = year.hospitals.filter((h) => h.hvbpFactor !== null);
  const vbpCut = vbp.filter((h) => (h.hvbpFactor ?? 1) < 1);
  const netCut = cohort.filter((h) => combinedAdjustment(h) < 1);
  const allThree = cohort.filter((h) => (h.hrrpFactor ?? 1) < 1 && h.hacPenalty && (h.hvbpFactor ?? 1) < 1);
  const deepest = Math.min(...cohort.map(combinedAdjustment));
  const averageCombined = cohort.reduce((s, h) => s + combinedAdjustment(h), 0) / cohort.length;

  const conditions = new Map<string, { scored: number; over: number }>();
  for (const h of cohort) {
    for (const [measure, ratio] of Object.entries(h.readmissionRatios)) {
      const c = conditions.get(measure) ?? { scored: 0, over: 0 };
      c.scored++;
      if (ratio > 1) c.over++;
      conditions.set(measure, c);
    }
  }
  const conditionText = [...conditions]
    .sort((a, b) => b[1].over / b[1].scored - a[1].over / a[1].scored)
    .map(([m, c]) => `${CONDITION_NAMES[m] ?? m} ${c.over.toLocaleString()} of ${c.scored.toLocaleString()} (${pct1(c.over / c.scored)})`)
    .join(", ");

  const hospitals = loadLatestSnapshot();
  const ownershipOf = new Map((hospitals?.rows ?? []).map((r) => [r.facility_id, r.hospital_ownership ?? "Unknown"]));
  const byOwnership = new Map<string, { n: number; cut: number }>();
  for (const h of cohort) {
    const key = ownershipOf.get(h.ccn);
    if (!key) continue;
    const g = byOwnership.get(key) ?? { n: 0, cut: 0 };
    g.n++;
    if (combinedAdjustment(h) < 1) g.cut++;
    byOwnership.set(key, g);
  }
  const joined = [...byOwnership.values()].reduce((s, g) => s + g.n, 0);
  const ownershipRows = [...byOwnership]
    .filter(([, g]) => g.n >= MIN_HOSPITALS_PER_OWNERSHIP)
    .map(([owner, g]) => ({ owner, ...g, share: g.cut / g.n }))
    .sort((a, b) => b.share - a.share);
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });
  const sourceIds = ownershipRows.length > 0 ? [PENALTY_SOURCE_ID, HOSPITAL_SOURCE_ID] : [PENALTY_SOURCE_ID];

  return validateInsight({
    id: `sig-reimbursement-${year.fiscalYear}-hospital-penalty-exposure`,
    headline: `${netCut.length.toLocaleString()} of ${cohort.length.toLocaleString()} hospitals (${pct1(netCut.length / cohort.length)}) take a net Medicare inpatient payment cut in FY${year.fiscalYear} from the readmissions, hospital-acquired condition and value-based purchasing programs combined; ${allThree.length.toLocaleString()} are cut by all three.`,
    questionId: "Q029",
    signalType: "baseline",
    period: fyPeriod(year.fiscalYear),
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States (hospitals paid under the inpatient prospective payment system)" },
    magnitude: { value: (netCut.length / cohort.length) * 100, unit: "percent", comparedTo: `${cohort.length.toLocaleString()} hospitals with a readmissions payment factor` },
    drivers: [
      {
        description: `Readmissions program: ${hrrpCut.length.toLocaleString()} of ${cohort.length.toLocaleString()} hospitals cut (factor below 1, deepest ${pctSigned(Math.min(...cohort.map((h) => h.hrrpFactor ?? 1)) - 1)}). Hospital-acquired condition program: ${hacCut.length.toLocaleString()} of ${hacScored.length.toLocaleString()} scored hospitals take the 1% cut. Value-based purchasing: ${vbpCut.length.toLocaleString()} of ${vbp.length.toLocaleString()} participating hospitals end below 1, the rest earn a net bonus. Combined, the average hospital's adjustment is ${pctSigned(averageCombined - 1)} and the deepest is ${pctSigned(deepest - 1)}. Hospitals with more readmissions than expected, by condition: ${conditionText}.`,
        supportingEvidenceIds: ["ev-penalty"],
        relationship: "stated-mechanism",
      },
      ...(ownershipRows.length > 0
        ? [
            {
              description: `Share with a net cut by ownership (${joined.toLocaleString()} of ${cohort.length.toLocaleString()} hospitals matched to Hospital General Information by CCN; groups under ${MIN_HOSPITALS_PER_OWNERSHIP} hospitals left out): ${ownershipRows.map((r) => `${r.owner} ${r.cut}/${r.n} (${pct1(r.share)})`).join(", ")}.`,
              supportingEvidenceIds: ["ev-penalty", "ev-hospitals"],
              relationship: "correlation" as const,
            },
          ]
        : []),
    ],
    businessRelevance:
      "Shows how widely Medicare's quality penalties reach into hospital inpatient payment this year, and which kinds of hospitals are most often on the losing side: a starting point for contracting and quality-partnership conversations.",
    evidence: [
      ...penaltyEvidence(year, "ev-penalty"),
      ...(ownershipRows.length > 0 && hospitals
        ? [{ id: "ev-hospitals", sourceId: HOSPITAL_SOURCE_ID, description: "CMS Hospital General Information, ownership by hospital", datasetVintage: hospitals.pulledAt.slice(0, 10) }]
        : []),
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Every factor is published by CMS for FY${year.fiscalYear}; one payment year is a baseline, not a trend.`,
    freshness: { dataAsOf: year.datasetModified.hac, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "Critical access, children's, psychiatric and other hospitals not paid under the inpatient prospective payment system are outside these programs; Maryland hospitals are paid under the state's own model.",
    ],
    nextSignal: `Watch the FY${year.fiscalYear + 1} readmissions and value-based purchasing factors CMS posts with the inpatient final rule, to see which hospitals move in or out of a net cut.`,
    recommendedInternalValidation: "Match these hospitals to a network's own facility contracts to see where Medicare penalties overlap with the plan's quality or value-based arrangements.",
    sourceIds,
    generatingAgent: AGENT_ID,
    ...(ownershipRows.length > 0
      ? {
          chart: {
            type: "bar" as const,
            title: `Hospitals with a net Medicare inpatient payment cut, FY${year.fiscalYear}, by ownership`,
            unit: "% of hospitals",
            bars: ownershipRows.map((r) => ({ label: r.owner, value: Math.round(r.share * 1000) / 10 })),
          },
        }
      : {}),
  });
}

async function statePressureInsight(year: HospitalPenaltyYear, cohort: HospitalPenaltyRow[], ctx: AgentContext): Promise<Insight | null> {
  const byState = new Map<string, HospitalPenaltyRow[]>();
  for (const h of cohort) if (h.state) byState.set(h.state, [...(byState.get(h.state) ?? []), h]);
  const rows = [...byState]
    .filter(([, hs]) => hs.length >= MIN_HOSPITALS_PER_STATE)
    .map(([state, hs]) => ({
      state,
      hospitals: hs.length,
      average: hs.reduce((s, h) => s + combinedAdjustment(h), 0) / hs.length - 1,
      cutShare: hs.filter((h) => combinedAdjustment(h) < 1).length / hs.length,
      hacShare: hs.filter((h) => h.hacPenalty).length / hs.length,
    }))
    .sort((a, b) => a.average - b.average);
  if (rows.length < 2) return null;
  const national = cohort.reduce((s, h) => s + combinedAdjustment(h), 0) / cohort.length - 1;
  const describe = (r: (typeof rows)[number]) =>
    `${r.hospitals} hospitals, average combined adjustment ${pctSigned(r.average)}, ${pct1(r.cutShare)} with a net cut, ${pct1(r.hacShare)} with the 1% hospital-acquired condition cut`;
  const candidates: Candidate[] = rows.map((r) => ({ id: r.state, label: r.state, summary: describe(r), primaryMetric: -r.average }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_STATES, taskDescription: `States where Medicare's hospital quality programs cut inpatient payment most, FY${year.fiscalYear}` },
    ctx
  );
  const byId = new Map(rows.map((r) => [r.state, r]));
  const selected = selections.map((s) => ({ row: byId.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;
  const worst = rows[0];
  const best = rows[rows.length - 1];
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-reimbursement-${year.fiscalYear}-hospital-penalty-by-state`,
    headline: `${worst.state}'s hospitals face the heaviest Medicare quality-program cuts in FY${year.fiscalYear}, averaging ${pctSigned(worst.average)} of base inpatient payment with ${pct1(worst.cutShare)} of hospitals cut, against ${pctSigned(national)} nationally; ${best.state} fares best at ${pctSigned(best.average)}.`,
    questionId: "Q030",
    signalType: "baseline",
    period: fyPeriod(year.fiscalYear),
    population: "medicare-ffs",
    geography: { level: "state", code: worst.state, label: worst.state },
    magnitude: { value: worst.average * 100, unit: "percent", comparedTo: `national average ${pctSigned(national)}`, delta: (worst.average - national) * 100 },
    drivers: [
      {
        description: `Average combined readmissions, hospital-acquired condition and value-based purchasing adjustment per hospital, by state (states with at least ${MIN_HOSPITALS_PER_STATE} hospitals in the programs, ${rows.length} states): ${selected.map(({ row, rationale }) => `${row.state}: ${describe(row)}${source === "llm" ? ` - ${rationale}` : ""}`).join("; ")}. Candidate selection method: ${source === "llm" ? `model-reasoned salience ranking over all ${rows.length} states` : "deterministic ranking by average cut"}.`,
        supportingEvidenceIds: ["ev-penalty-state"],
        relationship: "stated-mechanism",
      },
    ],
    businessRelevance:
      "Points to the markets where hospital inpatient margins are under the most Medicare quality-penalty pressure this year, which shapes hospitals' leverage and priorities in payer negotiations.",
    evidence: penaltyEvidence(year, "ev-penalty-state"),
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Published factors for every hospital in the programs; one payment year is a baseline.`,
    freshness: { dataAsOf: year.datasetModified.hac, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...COMMON_LIMITATIONS,
      "Covers facility payment pressure from these three programs only, not physician fee changes or other payment policy.",
      `States with fewer than ${MIN_HOSPITALS_PER_STATE} hospitals in the programs are left out; Maryland is not in them.`,
    ],
    nextSignal: `Compare with the FY${year.fiscalYear + 1} factors when CMS posts them with the inpatient final rule, to see whether the same states stay at the top.`,
    recommendedInternalValidation: "Weight these adjustments by a plan's or system's own inpatient volume by hospital to turn the averages into dollars.",
    sourceIds: [PENALTY_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Average combined Medicare quality-program adjustment per hospital, FY${year.fiscalYear}, by state`,
      unit: "% of base inpatient payment",
      bars: selected.map(({ row }) => ({ label: row.state, value: Math.round(row.average * 10000) / 100 })),
    },
  });
}

export async function hospitalPenaltyInsights(ctx: AgentContext): Promise<Insight[]> {
  const year = loadLatestPenaltyYear();
  if (!year) return [];
  const cohort = programCohort(year);
  const insights: Insight[] = [];
  const facility = facilityExposureInsight(year, cohort);
  if (facility) insights.push(facility);
  const states = await statePressureInsight(year, cohort, ctx);
  if (states) insights.push(states);
  return insights;
}
