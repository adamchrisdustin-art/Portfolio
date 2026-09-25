/**
 * Provider & Network Intelligence agent - see docs/cms-intelligence/
 * AGENT_ARCHITECTURE.md section 5 for full scope.
 *
 * Like the Market Growth agent, wired to the real, already-live Hospital
 * General Information dataset - see that file's header for why reusing
 * this dataset here is a documented exception, not a violation of the
 * pipeline/cms-intelligence isolation.
 *
 * Confidence and signalType are computed dynamically from real snapshot
 * history (cms-intelligence/data/sources/snapshotHistory.ts), not
 * hardcoded - same pattern as market-growth/agent.ts. As of 2026-09-23,
 * 3 real snapshots exist spanning 7 days with zero observed ownership
 * mix change, so this correctly stays "baseline"/"low" until real
 * change and/or more elapsed time exist - not a code limitation.
 *
 * Q125-Q128 added 2026-09-24 per Adam's PDF-annotated feedback request
 * for a star-rating-vs-quality-outcome read: a scatter plot (Q125,
 * correlating the real CMS overall star rating against a real net
 * quality-outcome score derived from the mortality/safety/readmission
 * measure-group counts already in this same dataset), a star-rating
 * boxplot by state (Q126), a quality-outcome-score boxplot by state
 * (Q127), and a states-improving-over-time check (Q128). Q128 is built
 * on the real snapshotHistory/meetsPersistence mechanism every other
 * agent uses - as of 2026-09-24 this dataset's quarterly-refresh cadence
 * means no state has genuinely moved across the 3 real pulls collected
 * so far, so Q128 honestly reports "no persistent improvement yet"
 * alongside a real current-snapshot ranking, rather than fabricating a
 * trend claim the data doesn't support.
 *
 * Q042/Q043 added 2026-09-24 per Adam's request for facility
 * closures-vs-openings tracking: these are pre-existing catalog
 * questions (EXECUTIVE_QUESTION_CATALOG.md's Provider & Network section)
 * this agent already owned but had never built. Implemented via the same
 * real `diffRows` mechanism the Data Source & CMS Change Monitor agent
 * uses (cms-intelligence/data/sources/diff.ts) - never a bespoke
 * reimplementation - applied across every consecutive pair of real
 * Hospital General Information snapshots, keyed on the real
 * `facility_id`. As of 2026-09-24, 3 real snapshots spanning 7 days show
 * ZERO real facility entries or exits - an honest finding given this
 * dataset's quarterly-refresh cadence and this project's real, still-
 * short pull history, not a system limitation.
 *
 * Salience layer (intelligence/salience/selectNoteworthy.ts, retrofitted
 * 2026-09-24) chooses which ownership types the Q038 donut breaks out,
 * which states the Q126/Q127 boxplots show, and which states Q128 lists -
 * deterministic top-N when no model is configured (identical to this
 * agent's original output), model-reasoned when one is. CR4 itself is
 * NOT routed through it: a concentration ratio is definitionally the top
 * 4 categories by count, not a judgment call. Q125 and Q042/Q043 have no
 * ranking step, so they're untouched.
 */
import {
  listSnapshotFiles,
  loadSnapshot,
  SOURCE_ID,
  type HospitalRow,
  type HospitalSnapshot,
} from "../../data/adapters/hospitalGeneralInformation";
import { assessSnapshotHistory, dateFromSnapshotFilename, directionsAcrossSnapshots, type SnapshotHistoryAssessment } from "../../data/sources/snapshotHistory";
import { diffRows } from "../../data/sources/diff";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { concentrationRatio, pearsonCorrelation, tukeyBox } from "../../intelligence/metrics/metrics";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence, meetsPersistence } from "../../intelligence/trends/trend";
import type { AgentContext, DomainAgent } from "../types";

const AGENT_ID = "provider-network-intelligence";
const TOP_N_OWNERSHIP_TYPES = 4;
const DONUT_TOP_N_OWNERSHIP_TYPES = 5;
const MIN_HOSPITALS_FOR_STATE_BOX = 20; // same floor as market-growth's home-health per-state read
const BOXPLOT_TOP_N_STATES = 8;
const TOP_N_STATES_QUALITY = 5;
const SCATTER_POINT_CAP = 400;
const MIN_HOSPITALS_FOR_CORRELATION = 30;

/** Real CMS Hospital Compare measure groups this dataset reports "better/worse/no different than national" counts for. */
const QUALITY_MEASURE_GROUPS = ["mort", "safety", "readm"] as const;

interface HospitalQualityRow {
  facilityId: string;
  facilityName: string;
  state: string;
  starRating: number;
  /** (measures rated "better than national" - measures rated "worse") / total measures assessed, across mortality/safety/readmission groups, as a percent. */
  netQualityPct: number;
}

function groupCounts(row: HospitalRow, prefix: string): { better: number; worse: number; noDifferent: number } | null {
  const better = Number(row[`count_of_${prefix}_measures_better`]);
  const worse = Number(row[`count_of_${prefix}_measures_worse`]);
  const noDifferent = Number(row[`count_of_${prefix}_measures_no_different`]);
  if (Number.isNaN(better) || Number.isNaN(worse) || Number.isNaN(noDifferent)) return null;
  return { better, worse, noDifferent };
}

/**
 * Real per-hospital rows with both a usable star rating and complete
 * quality-measure-group counts. Hospitals with a suppressed/"Not
 * Available" rating or measure count are excluded outright, never
 * treated as zero - CMS suppresses small cells for privacy, and a
 * missing value is not the same real finding as a zero.
 */
function extractQualityRows(rows: HospitalRow[]): HospitalQualityRow[] {
  const out: HospitalQualityRow[] = [];
  for (const row of rows) {
    if (!row.state) continue;
    const starRating = Number(row.hospital_overall_rating);
    if (Number.isNaN(starRating)) continue;

    const groups = QUALITY_MEASURE_GROUPS.map((prefix) => groupCounts(row, prefix));
    if (groups.some((g) => g === null)) continue;

    let better = 0;
    let worse = 0;
    let total = 0;
    for (const g of groups as { better: number; worse: number; noDifferent: number }[]) {
      better += g.better;
      worse += g.worse;
      total += g.better + g.worse + g.noDifferent;
    }
    if (total === 0) continue;

    out.push({
      facilityId: row.facility_id,
      facilityName: row.facility_name,
      state: row.state,
      starRating,
      netQualityPct: ((better - worse) / total) * 100,
    });
  }
  return out;
}

/** Exported for reuse by the Data Explorer analytics section - see cms-intelligence/analytics/overview.ts. */
export function cr4For(rows: { hospital_ownership?: string }[]): number {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const ownership = row.hospital_ownership ?? "Unknown";
    counts.set(ownership, (counts.get(ownership) ?? 0) + 1);
  }
  const sortedValues = Array.from(counts.values()).sort((a, b) => b - a);
  return concentrationRatio(sortedValues, TOP_N_OWNERSHIP_TYPES, rows.length);
}

export const providerNetworkAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: ["Q036", "Q037", "Q038", "Q042", "Q043", "Q125", "Q126", "Q127", "Q128"],

  async run(ctx: AgentContext): Promise<Insight[]> {
    const files = listSnapshotFiles();
    if (files.length === 0) return [];

    const snapshots = files.map((f) => ({ date: dateFromSnapshotFilename(f), snapshot: loadSnapshot(f) }));
    const latest = snapshots[snapshots.length - 1].snapshot;
    if (latest.rows.length === 0) return [];

    const history = assessSnapshotHistory(snapshots.map((s) => s.date));
    const cr4Series = snapshots.map((s) => cr4For(s.snapshot.rows));
    const directions = directionsAcrossSnapshots(cr4Series);
    const confidence = classifyConfidence({
      persistenceMet: meetsPersistence(directions),
      hasFullBaseline: history.hasFullBaseline,
      hasExternalCorroboration: false,
    });

    const countsByOwnership = new Map<string, number>();
    for (const row of latest.rows) {
      const ownership = row.hospital_ownership ?? "Unknown";
      countsByOwnership.set(ownership, (countsByOwnership.get(ownership) ?? 0) + 1);
    }
    const ranked = Array.from(countsByOwnership.entries()).sort((a, b) => b[1] - a[1]);
    const topTypes = ranked.slice(0, TOP_N_OWNERSHIP_TYPES).map(([type]) => type);
    const cr4 = cr4Series[cr4Series.length - 1];

    const totalFacilities = latest.rows.length;
    const ownershipCandidates: Candidate[] = ranked.map(([type, count]) => ({
      id: type,
      label: type,
      summary: `${count} facilities (${((count / totalFacilities) * 100).toFixed(1)}% of ${totalFacilities} nationally)`,
      primaryMetric: count,
    }));
    const { selections: donutSelections, source: donutSource } = await selectNoteworthy(
      { candidates: ownershipCandidates, topN: DONUT_TOP_N_OWNERSHIP_TYPES, taskDescription: "hospital ownership types to break out in a share-of-facilities chart this cycle" },
      ctx
    );
    const countByOwnership = new Map(ranked);
    const chartTop = donutSelections.filter((s) => countByOwnership.has(s.candidateId)).map((s): [string, number] => [s.candidateId, countByOwnership.get(s.candidateId)!]);
    const chartOtherCount = totalFacilities - chartTop.reduce((sum, [, count]) => sum + count, 0);
    const donutSelectionNote =
      donutSource === "llm"
        ? ` Ownership types broken out in the chart were chosen by model-reasoned salience ranking: ${donutSelections.map((s) => `${s.candidateId} — ${s.rationale}`).join("; ")}.`
        : "";

    const signalType = meetsPersistence(directions) ? "trend" : "baseline";
    const headline =
      signalType === "trend"
        ? `Hospital ownership concentration (CR${TOP_N_OWNERSHIP_TYPES}) has moved ${directions[directions.length - 1]} across the last ${history.snapshotCount} real pulls (${history.earliestDate} → ${history.latestDate}).`
        : `The top ${TOP_N_OWNERSHIP_TYPES} hospital ownership types (${topTypes.join(", ")}) account for ${cr4.toFixed(1)}% of all facilities nationally, as of the current CMS snapshot.`;

    const insight: Insight = {
      id: `sig-provider-network-${history.latestDate}-ownership-concentration`,
      headline,
      questionId: "Q038",
      signalType,
      period: { start: history.earliestDate, end: history.latestDate },
      population: "medicare-ffs",
      geography: { level: "national", code: "US", label: "United States" },
      magnitude: { value: cr4, unit: "percent", comparedTo: "total facilities nationally" },
      drivers: [
        {
          description: `Ownership-type distribution across ${ranked.length} distinct categories. CR${TOP_N_OWNERSHIP_TYPES} across ${history.snapshotCount} real pulls: ${cr4Series.map((v) => v.toFixed(1)).join(" → ")}%.${donutSelectionNote}`,
          supportingEvidenceIds: ["ev-hgi-snapshot"],
          relationship: "correlation",
        },
      ],
      businessRelevance:
        signalType === "trend"
          ? "A real, multi-pull shift in national ownership concentration - worth checking what ownership changes are driving it."
          : "A CR4 concentration baseline for hospital ownership - no real concentration change has been observed yet across the pulls collected so far.",
      evidence: [
        {
          id: "ev-hgi-snapshot",
          sourceId: SOURCE_ID,
          description: `CMS Hospital General Information, ${history.snapshotCount} real snapshot(s) from ${history.earliestDate} to ${history.latestDate}`,
          datasetVintage: history.latestDate,
        },
      ],
      contradictoryEvidence: [],
      confidence: confidence.level,
      confidenceRationale: `${confidence.rationale} Based on ${history.snapshotCount} real snapshot(s) spanning ${history.daysOfHistory} day(s) (TREND_FRAMEWORK.md's full baseline window is 730 days).`,
      freshness: { dataAsOf: history.latestDate, generatedAt: new Date().toISOString(), isStale: false },
      limitations: [
        "Ownership-type concentration, not entity-level concentration - two facilities under the same ownership *type* are not necessarily the same owner.",
        `Baseline window is ${history.daysOfHistory} real day(s) so far, well short of the 24-month window this framework requires for full confidence.`,
      ],
      nextSignal: "Watch subsequent real pulls for an ownership-type mix shift.",
      recommendedInternalValidation: "Not applicable - this is public aggregate data, not tied to any specific payer's contracted network.",
      sourceIds: [SOURCE_ID],
      generatingAgent: AGENT_ID,
      series:
        cr4Series.length >= 2
          ? {
              label: `Hospital ownership concentration (CR${TOP_N_OWNERSHIP_TYPES})`,
              unit: "percent",
              points: snapshots.map((s, i) => ({ date: s.date, value: cr4Series[i] })),
            }
          : undefined,
      chart: {
        type: "donut",
        title: "Hospital ownership type, share of facilities",
        unit: "facilities",
        slices: [
          ...chartTop.map(([type, count]) => ({ label: type, value: count })),
          ...(chartOtherCount > 0 ? [{ label: "Other", value: chartOtherCount }] : []),
        ],
      },
    };

    const insights = [validateInsight(insight)];

    const qualityRows = extractQualityRows(latest.rows);
    const correlationInsight = buildQualityCorrelationSignal(qualityRows, history);
    if (correlationInsight) insights.push(correlationInsight);
    const starByStateInsight = await buildStarRatingByStateSignal(qualityRows, history, ctx);
    if (starByStateInsight) insights.push(starByStateInsight);
    const outcomeByStateInsight = await buildQualityOutcomeByStateSignal(qualityRows, history, ctx);
    if (outcomeByStateInsight) insights.push(outcomeByStateInsight);
    const qualityTrendInsight = await buildQualityByGeographyTrendSignal(snapshots.map((s) => s.snapshot.rows), history, ctx);
    if (qualityTrendInsight) insights.push(qualityTrendInsight);

    const facilityChanges = accumulateFacilityChanges(snapshots);
    const entriesInsight = buildFacilityEntriesSignal(facilityChanges, history);
    if (entriesInsight) insights.push(entriesInsight);
    const exitsInsight = buildFacilityExitsSignal(facilityChanges, history);
    if (exitsInsight) insights.push(exitsInsight);

    return insights;
  },
};

// ---------------------------------------------------------------------------
// Star rating vs. quality outcomes (Q125-Q128, added 2026-09-24)
// ---------------------------------------------------------------------------

function buildQualityCorrelationSignal(qualityRows: HospitalQualityRow[], history: SnapshotHistoryAssessment): Insight | null {
  if (qualityRows.length < MIN_HOSPITALS_FOR_CORRELATION) return null;

  const xs = qualityRows.map((r) => r.starRating);
  const ys = qualityRows.map((r) => r.netQualityPct);
  const r = pearsonCorrelation(xs, ys);
  const absR = Math.abs(r);
  const strength = absR >= 0.5 ? "moderate-to-strong" : absR >= 0.3 ? "moderate" : absR >= 0.1 ? "weak" : "negligible";
  const direction = r > 0 ? "positive" : r < 0 ? "negative" : "no";

  // Deterministic evenly-spaced sample for the chart itself (sorted by
  // facility_id for reproducibility) - the correlation coefficient above
  // is computed across the full real qualityRows population, not this
  // rendering-sized sample.
  const sortedById = [...qualityRows].sort((a, b) => (a.facilityId < b.facilityId ? -1 : a.facilityId > b.facilityId ? 1 : 0));
  const step = Math.max(1, Math.ceil(sortedById.length / SCATTER_POINT_CAP));
  const sampledForChart = sortedById.filter((_, i) => i % step === 0);

  const insight: Insight = {
    id: `sig-provider-network-${history.latestDate}-quality-correlation`,
    headline: `Across ${qualityRows.length} real hospitals with both a CMS overall star rating and complete mortality/safety/readmission measure counts, star rating and net quality-outcome performance show a ${strength} ${direction} correlation (Pearson r = ${r.toFixed(2)}).`,
    questionId: "Q125",
    signalType: "baseline",
    period: { start: history.earliestDate, end: history.latestDate },
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: r, unit: "pearson-r", comparedTo: `${qualityRows.length} real hospitals` },
    drivers: [
      {
        description: `Real per-hospital net quality-outcome score - (measures rated "better than national" minus measures rated "worse than national") / total measures assessed, across the real mortality, safety, and readmission measure groups, as a percent - correlated against the real CMS Hospital Overall Star Rating (1-5) across ${qualityRows.length} hospitals with both fields present. Pearson r = ${r.toFixed(3)}.`,
        supportingEvidenceIds: ["ev-quality-correlation"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Tests whether CMS's headline star rating actually tracks the underlying real outcome measures it's meant to summarize - relevant to whether star rating alone is a sufficient quality proxy for network or quality-incentive decisions, or whether the underlying measure detail should be reviewed directly.",
    evidence: [
      {
        id: "ev-quality-correlation",
        sourceId: SOURCE_ID,
        description: `CMS Hospital General Information, real hospital_overall_rating and count_of_{mort,safety,readm}_measures_{better,worse,no_different} fields across ${qualityRows.length} hospitals, ${history.latestDate}`,
        datasetVintage: history.latestDate,
      },
    ],
    contradictoryEvidence: [],
    confidence: "low",
    confidenceRationale:
      "A cross-sectional correlation from a single real snapshot, not yet observed to persist across multiple pulls. Correlation alone is never sufficient grounds for a causal claim regardless of persistence - this insight's driver is explicitly marked \"correlation\", never \"confirmed-causal\".",
    freshness: { dataAsOf: history.latestDate, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "Correlation, not causation - the star rating methodology itself partly derives from these same measure groups, so some correlation is expected by construction, not solely reflecting an independently corroborating quality signal.",
      "The star rating also incorporates real patient-experience and timely-and-effective-care measure groups (plus CMS's own weighting/imputation methodology) that this net quality-outcome score does not include, so a moderate rather than perfect correlation is the honestly expected result even if the two were measuring the same underlying construct.",
      `Limited to the ${qualityRows.length} hospitals with both a numeric star rating and complete mortality/safety/readmission measure counts - hospitals with a suppressed/"Not Available" rating or measure count are excluded outright, never treated as zero.`,
      `Chart shows a deterministic, evenly-spaced sample of ${sampledForChart.length} of these ${qualityRows.length} real hospitals for rendering size - the correlation coefficient above is computed across the full ${qualityRows.length}-hospital real sample, not the chart's sample.`,
    ],
    nextSignal: "Watch this correlation across a second real pull once CMS's quarterly measure refresh next lands, to see whether the relationship's strength itself is stable.",
    recommendedInternalValidation: "Not applicable - this is public aggregate quality-measure data, not tied to any specific payer's network.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "scatter",
      title: "Hospital overall star rating vs. net quality-outcome score",
      xLabel: "CMS overall star rating",
      yLabel: "Net quality-outcome score",
      xUnit: "stars",
      yUnit: "%",
      points: sampledForChart.map((row) => ({
        label: `${row.facilityName} (${row.state})`,
        x: row.starRating,
        y: Math.round(row.netQualityPct * 10) / 10,
      })),
    },
  };

  return validateInsight(insight);
}

type StateBox = { label: string } & ReturnType<typeof tukeyBox>;

/**
 * Deterministic fallback = the top BOXPLOT_TOP_N_STATES states by hospital
 * sample size (this agent's original rule). Boxes come back sorted by
 * median, highest first, so boxes[0]/boxes[last] are the true highest/
 * lowest among whatever states were selected.
 */
async function selectStateBoxes(
  qualityRows: HospitalQualityRow[],
  value: (r: HospitalQualityRow) => number,
  formatMedian: (v: number) => string,
  taskDescription: string,
  ctx: AgentContext
): Promise<{ boxes: StateBox[]; source: "llm" | "deterministic"; eligibleCount: number; rationales: Map<string, string> }> {
  const byState = new Map<string, number[]>();
  for (const r of qualityRows) {
    if (!byState.has(r.state)) byState.set(r.state, []);
    byState.get(r.state)!.push(value(r));
  }
  const withEnough = Array.from(byState.entries()).filter(([, values]) => values.length >= MIN_HOSPITALS_FOR_STATE_BOX);
  const allBoxes = new Map(withEnough.map(([state, values]): [string, StateBox] => [state, { label: state, ...tukeyBox(values) }]));
  const candidates: Candidate[] = Array.from(allBoxes.values()).map((b) => ({
    id: b.label,
    label: b.label,
    summary: `${b.sampleSize} hospitals, median ${formatMedian(b.median)} (IQR ${formatMedian(b.q1)} to ${formatMedian(b.q3)})`,
    primaryMetric: b.sampleSize,
  }));
  const { selections, source } = await selectNoteworthy({ candidates, topN: BOXPLOT_TOP_N_STATES, taskDescription }, ctx);
  const picked = selections.filter((s) => allBoxes.has(s.candidateId));
  const boxes = picked.map((s) => allBoxes.get(s.candidateId)!).sort((a, b) => b.median - a.median);
  return { boxes, source, eligibleCount: candidates.length, rationales: new Map(picked.map((s) => [s.candidateId, s.rationale])) };
}

async function buildStarRatingByStateSignal(qualityRows: HospitalQualityRow[], history: SnapshotHistoryAssessment, ctx: AgentContext): Promise<Insight | null> {
  const { boxes, source, eligibleCount, rationales } = await selectStateBoxes(
    qualityRows,
    (r) => r.starRating,
    (v) => `${v.toFixed(1)}★`,
    "hospital overall star rating distribution by state this cycle",
    ctx
  );
  if (boxes.length === 0) return null;
  const llm = source === "llm";

  const highest = boxes[0];
  const lowest = boxes[boxes.length - 1];
  const totalHospitals = boxes.reduce((s, b) => s + b.sampleSize, 0);

  const insight: Insight = {
    id: `sig-provider-network-${history.latestDate}-star-rating-by-state`,
    headline: `Among the ${boxes.length} ${llm ? "states selected as most noteworthy" : "states with the most hospitals reporting a real overall star rating"}, ${highest.label} has the highest median (${highest.median.toFixed(1)}★) and ${lowest.label} the lowest (${lowest.median.toFixed(1)}★).`,
    questionId: "Q126",
    signalType: "baseline",
    period: { start: history.earliestDate, end: history.latestDate },
    population: "medicare-ffs",
    geography: { level: "state", code: boxes.map((b) => b.label).join("/"), label: boxes.map((b) => b.label).join(", ") },
    magnitude: {
      value: highest.median,
      unit: "stars",
      comparedTo: `${lowest.label} median (${lowest.median.toFixed(1)})`,
      delta: highest.median - lowest.median,
    },
    drivers: [
      {
        description: `Real per-hospital CMS overall star ratings (1-5), grouped by state, ${stateScope(boxes.length, eligibleCount, llm)} (>=${MIN_HOSPITALS_FOR_STATE_BOX} hospitals each): ${boxes.map((b) => withStateRationale(`${b.label} median ${b.median.toFixed(1)} (n=${b.sampleSize})`, rationales.get(b.label), llm)).join("; ")}.`,
        supportingEvidenceIds: ["ev-star-by-state"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "A real, state-level distributional read on hospital quality star ratings - a starting point for network-quality-by-geography questions, not a claim about why any state's distribution sits where it does.",
    evidence: [
      {
        id: "ev-star-by-state",
        sourceId: SOURCE_ID,
        description: `CMS Hospital General Information, real hospital_overall_rating field across ${totalHospitals} hospitals in ${llm ? `the ${boxes.length} selected states` : `the top ${boxes.length} states by sample size`}, ${history.latestDate}`,
        datasetVintage: history.latestDate,
      },
    ],
    contradictoryEvidence: [],
    confidence: "low",
    confidenceRationale:
      "A single real cross-sectional snapshot - not yet observed to persist across multiple pulls, and this dataset refreshes quarterly so genuine week-to-week movement isn't expected yet at this cadence.",
    freshness: { dataAsOf: history.latestDate, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Limited to the ${boxes.length} states with at least ${MIN_HOSPITALS_FOR_STATE_BOX} hospitals reporting a real, non-suppressed star rating - smaller states/territories are excluded to avoid a noisy few-hospital read, not because their data is less real.`,
      "Star rating is CMS's own composite methodology (incorporating mortality, safety, readmission, patient experience, and timely-and-effective-care measure groups plus its own weighting/imputation) - this box shows the rating's real distribution, not a re-derivation of it.",
    ],
    nextSignal: "Watch this state ranking across CMS's next quarterly refresh for the first genuine multi-period shift.",
    recommendedInternalValidation: "Not applicable - this is public aggregate quality-measure data.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "boxplot",
      title: `Hospital overall star rating distribution, ${llm ? `${boxes.length} states selected as most noteworthy` : `top ${boxes.length} states by hospital count`}`,
      unit: "stars",
      boxes,
    },
  };

  return validateInsight(insight);
}

function stateScope(shown: number, eligible: number, llm: boolean): string {
  return llm ? `${shown} states selected by model-reasoned salience ranking over all ${eligible} eligible states` : `top ${shown} states by hospital sample size`;
}

function withStateRationale(text: string, rationale: string | undefined, llm: boolean): string {
  return llm && rationale ? `${text} — ${rationale}` : text;
}

async function buildQualityOutcomeByStateSignal(qualityRows: HospitalQualityRow[], history: SnapshotHistoryAssessment, ctx: AgentContext): Promise<Insight | null> {
  const { boxes, source, eligibleCount, rationales } = await selectStateBoxes(
    qualityRows,
    (r) => r.netQualityPct,
    (v) => `${v.toFixed(1)}%`,
    "hospital net quality-outcome score distribution by state this cycle",
    ctx
  );
  if (boxes.length === 0) return null;
  const llm = source === "llm";

  const highest = boxes[0];
  const lowest = boxes[boxes.length - 1];
  const totalHospitals = boxes.reduce((s, b) => s + b.sampleSize, 0);

  const insight: Insight = {
    id: `sig-provider-network-${history.latestDate}-quality-outcome-by-state`,
    headline: `Among the ${boxes.length} ${llm ? "states selected as most noteworthy" : "states with the most assessable hospitals"}, ${highest.label} has the best median net quality-outcome score (${highest.median.toFixed(1)}%) and ${lowest.label} the worst (${lowest.median.toFixed(1)}%).`,
    questionId: "Q127",
    signalType: "baseline",
    period: { start: history.earliestDate, end: history.latestDate },
    population: "medicare-ffs",
    geography: { level: "state", code: boxes.map((b) => b.label).join("/"), label: boxes.map((b) => b.label).join(", ") },
    magnitude: {
      value: highest.median,
      unit: "percent",
      comparedTo: `${lowest.label} median (${lowest.median.toFixed(1)}%)`,
      delta: highest.median - lowest.median,
    },
    drivers: [
      {
        description: `Real per-hospital net quality-outcome score (share of mortality/safety/readmission measures rated "better than national" minus "worse", as a percent), grouped by state, ${stateScope(boxes.length, eligibleCount, llm)} (>=${MIN_HOSPITALS_FOR_STATE_BOX} hospitals each): ${boxes.map((b) => withStateRationale(`${b.label} median ${b.median.toFixed(1)}% (n=${b.sampleSize})`, rationales.get(b.label), llm)).join("; ")}.`,
        supportingEvidenceIds: ["ev-outcome-by-state"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "A real, state-level read on hospital quality *outcomes* specifically (not the composite star rating) - useful alongside Q126 to see whether a state's star-rating standing and its underlying outcome-measure performance tell the same story.",
    evidence: [
      {
        id: "ev-outcome-by-state",
        sourceId: SOURCE_ID,
        description: `CMS Hospital General Information, real count_of_{mort,safety,readm}_measures_{better,worse,no_different} fields across ${totalHospitals} hospitals in ${llm ? `the ${boxes.length} selected states` : `the top ${boxes.length} states by sample size`}, ${history.latestDate}`,
        datasetVintage: history.latestDate,
      },
    ],
    contradictoryEvidence: [],
    confidence: "low",
    confidenceRationale:
      "A single real cross-sectional snapshot - not yet observed to persist across multiple pulls, and this dataset refreshes quarterly so genuine week-to-week movement isn't expected yet at this cadence.",
    freshness: { dataAsOf: history.latestDate, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Limited to the ${boxes.length} states with at least ${MIN_HOSPITALS_FOR_STATE_BOX} hospitals with a complete, non-suppressed real measure-group count - smaller states/territories are excluded to avoid a noisy few-hospital read.`,
      "Net quality-outcome score only covers the mortality, safety, and readmission measure groups this dataset reports a better/worse/no-different count for - it does not include patient-experience or timely-and-effective-care measures.",
    ],
    nextSignal: "Watch this state ranking across CMS's next quarterly refresh for the first genuine multi-period shift.",
    recommendedInternalValidation: "Not applicable - this is public aggregate quality-measure data.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "boxplot",
      title: `Net quality-outcome score distribution, ${llm ? `${boxes.length} states selected as most noteworthy` : `top ${boxes.length} states by hospital count`}`,
      unit: "%",
      boxes,
    },
  };

  return validateInsight(insight);
}

async function buildQualityByGeographyTrendSignal(
  rowsPerSnapshot: HospitalRow[][],
  history: SnapshotHistoryAssessment,
  ctx: AgentContext
): Promise<Insight | null> {
  const perSnapshotStateMedians = rowsPerSnapshot.map((rows) => {
    const qualityRows = extractQualityRows(rows);
    const byState = new Map<string, number[]>();
    for (const r of qualityRows) {
      if (!byState.has(r.state)) byState.set(r.state, []);
      byState.get(r.state)!.push(r.netQualityPct);
    }
    const medians = new Map<string, number>();
    for (const [state, values] of byState) {
      if (values.length < MIN_HOSPITALS_FOR_STATE_BOX) continue;
      const sorted = [...values].sort((a, b) => a - b);
      medians.set(state, sorted[Math.floor(sorted.length / 2)]);
    }
    return medians;
  });

  const latestMedians = perSnapshotStateMedians[perSnapshotStateMedians.length - 1];
  if (latestMedians.size === 0) return null;

  // Only states with enough real hospitals in EVERY real pull collected
  // so far are eligible for a fair across-time direction comparison.
  const statesInEvery = Array.from(latestMedians.keys()).filter((state) => perSnapshotStateMedians.every((m) => m.has(state)));
  if (statesInEvery.length === 0) return null;

  const improvingStates: string[] = [];
  for (const state of statesInEvery) {
    const series = perSnapshotStateMedians.map((m) => m.get(state)!);
    const directions = directionsAcrossSnapshots(series);
    if (meetsPersistence(directions) && directions[directions.length - 1] === "up") improvingStates.push(state);
  }

  const rankedCurrent = Array.from(latestMedians.entries())
    .filter(([state]) => statesInEvery.includes(state))
    .sort((a, b) => b[1] - a[1]);
  const candidates: Candidate[] = rankedCurrent.map(([state, median]) => ({
    id: state,
    label: state,
    summary: `current median net quality-outcome score ${median.toFixed(1)}%; across ${history.snapshotCount} real pull(s): ${perSnapshotStateMedians.map((m) => m.get(state)!.toFixed(1)).join(" → ")}%${improvingStates.includes(state) ? " (meets the persistence rule for real improvement)" : ""}`,
    primaryMetric: median,
  }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_STATES_QUALITY, taskDescription: "state-level hospital quality outcomes (current level and change across pulls) this cycle" },
    ctx
  );
  const llm = source === "llm";
  const medianByState = new Map(rankedCurrent);
  const picked = selections.filter((s) => medianByState.has(s.candidateId));
  const top = picked.map((s): [string, number] => [s.candidateId, medianByState.get(s.candidateId)!]);
  const rationaleByState = new Map(picked.map((s) => [s.candidateId, s.rationale]));
  // "Best current score" claims must hold regardless of which states the selection picked.
  const best = rankedCurrent[0];
  const topList = top.map(([s, v]) => withStateRationale(`${s} (${v.toFixed(1)}%)`, rationaleByState.get(s), llm)).join(", ");
  const topLabel = llm ? "States selected as most noteworthy by model-reasoned salience ranking" : "Current top states";
  const confidence = classifyConfidence({
    persistenceMet: improvingStates.length > 0,
    hasFullBaseline: history.hasFullBaseline,
    hasExternalCorroboration: false,
  });

  const headline =
    improvingStates.length > 0
      ? `${improvingStates.join(", ")} show a real, persistent improvement in net quality-outcome score across the last ${history.snapshotCount} real pulls; currently, ${best[0]} has the best net quality-outcome score (${best[1].toFixed(1)}%) among states with enough hospitals to assess.`
      : `No state has yet shown a persistent real improvement in net quality-outcome score across the ${history.snapshotCount} real pull(s) collected so far (this CMS dataset refreshes quarterly, and only ${history.daysOfHistory} real day(s) of history exist); currently, ${best[0]} has the best net quality-outcome score (${best[1].toFixed(1)}%) among states with enough hospitals to assess.`;

  const insight: Insight = {
    id: `sig-provider-network-${history.latestDate}-quality-by-geography-trend`,
    headline,
    questionId: "Q128",
    signalType: improvingStates.length > 0 ? "trend" : "baseline",
    period: { start: history.earliestDate, end: history.latestDate },
    population: "medicare-ffs",
    geography: { level: "state", code: top.map(([s]) => s).join("/"), label: top.map(([s]) => s).join(", ") },
    magnitude: { value: best[1], unit: "percent", comparedTo: `${rankedCurrent.length} states assessed` },
    drivers: [
      {
        description:
          improvingStates.length > 0
            ? `States meeting the 2-consecutive-pull persistence rule for an improving real net quality-outcome median: ${improvingStates.join(", ")}. ${topLabel} by net quality-outcome score: ${topList}.`
            : `${topLabel} by real net quality-outcome score (single-snapshot cross-sectional ranking, not yet a confirmed trend): ${topList}. Real per-state median net quality-outcome score across ${history.snapshotCount} real pull(s): ${statesInEvery
                .slice(0, 5)
                .map((s) => `${s}: ${perSnapshotStateMedians.map((m) => m.get(s)!.toFixed(1)).join(" → ")}`)
                .join("; ")}.`,
        supportingEvidenceIds: ["ev-quality-trend"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Directly answers whether any state shows real, sustained improvement in hospital quality outcomes over time, alongside a current-state ranking of where quality is best right now - both genuinely useful reads for network-investment and quality-incentive prioritization, reported honestly rather than forcing a 'trend' claim before one is real.",
    evidence: [
      {
        id: "ev-quality-trend",
        sourceId: SOURCE_ID,
        description: `CMS Hospital General Information, real per-state median net quality-outcome score across ${history.snapshotCount} real pull(s), ${history.earliestDate} to ${history.latestDate}`,
        datasetVintage: history.latestDate,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Based on ${history.snapshotCount} real snapshot(s) spanning ${history.daysOfHistory} day(s) (TREND_FRAMEWORK.md's full baseline window is 730 days); this CMS dataset itself refreshes quarterly, so genuine movement isn't expected at a sub-quarterly cadence regardless of pull frequency.`,
    freshness: { dataAsOf: history.latestDate, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Limited to the ${statesInEvery.length} states with at least ${MIN_HOSPITALS_FOR_STATE_BOX} hospitals with a real, non-suppressed net quality-outcome score in every real pull collected so far.`,
      "This dataset is CMS's own quarterly-refresh hospital quality data - real week-to-week pulls are not expected to show movement until the next quarterly refresh actually lands; a 'no persistent improvement yet' finding reflects that real refresh cadence, not a system limitation.",
      "Tracks each state's median net quality-outcome score across all qualifying hospitals in that state, not any individual hospital's own trajectory.",
    ],
    nextSignal: "Watch every eligible state's median net quality-outcome score across CMS's next quarterly refresh for the first genuine, assessable direction of change.",
    recommendedInternalValidation: "Not applicable - this is public aggregate quality-measure data.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: llm
        ? `Current net quality-outcome score, ${top.length} states selected as most noteworthy`
        : `States with the best current net quality-outcome score (top ${top.length})`,
      unit: "%",
      bars: top.map(([s, v]) => ({ label: s, value: Math.round(v * 10) / 10 })),
    },
  };

  return validateInsight(insight);
}

// ---------------------------------------------------------------------------
// Facility entries/exits (Q042/Q043, added 2026-09-24)
// ---------------------------------------------------------------------------

interface FacilityChangeEvent {
  facilityId: string;
  facilityName: string;
  state: string;
  observedBetween: { from: string; to: string }; // the real pair of snapshot dates where this was first observed
}

interface AccumulatedFacilityChanges {
  entries: FacilityChangeEvent[];
  exits: FacilityChangeEvent[];
}

/**
 * Real diffRows() (cms-intelligence/data/sources/diff.ts - the same
 * mechanism the Data Source & CMS Change Monitor agent uses) applied
 * across every consecutive pair of real snapshots, accumulated into one
 * list each of real entries and real exits observed so far. A facility
 * present in every real snapshot collected contributes nothing here -
 * that's the honest, expected case given this dataset's real
 * quarterly-refresh cadence and this project's still-short pull history.
 */
function accumulateFacilityChanges(snapshots: { date: string; snapshot: HospitalSnapshot }[]): AccumulatedFacilityChanges {
  const entries: FacilityChangeEvent[] = [];
  const exits: FacilityChangeEvent[] = [];

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    const diff = diffRows(prev.snapshot.rows, curr.snapshot.rows, "facility_id", []);
    for (const row of diff.added) {
      entries.push({ facilityId: row.facility_id, facilityName: row.facility_name, state: row.state, observedBetween: { from: prev.date, to: curr.date } });
    }
    for (const row of diff.removed) {
      exits.push({ facilityId: row.facility_id, facilityName: row.facility_name, state: row.state, observedBetween: { from: prev.date, to: curr.date } });
    }
  }

  return { entries, exits };
}

function buildFacilityChangeSignal(
  events: FacilityChangeEvent[],
  eventNoun: "entry" | "exit",
  questionId: string,
  history: SnapshotHistoryAssessment
): Insight | null {
  if (history.snapshotCount < 2) return null; // needs at least 2 real snapshots to diff at all

  const eventNounPlural = eventNoun === "entry" ? "entries" : "exits";
  const stamp = history.latestDate;
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: history.hasFullBaseline, hasExternalCorroboration: false });

  const headline =
    events.length === 0
      ? `Zero real facility ${eventNounPlural} observed across the ${history.snapshotCount} real Hospital General Information pulls collected so far (${history.earliestDate} to ${history.latestDate}).`
      : `${events.length} real facility ${eventNounPlural} observed across the ${history.snapshotCount} real Hospital General Information pulls collected so far - most recently ${events[events.length - 1].facilityName} (${events[events.length - 1].state}), between ${events[events.length - 1].observedBetween.from} and ${events[events.length - 1].observedBetween.to}.`;

  const insight: Insight = {
    id: `sig-provider-network-${stamp}-facility-${eventNounPlural}`,
    headline,
    questionId,
    signalType: "baseline",
    period: { start: history.earliestDate, end: history.latestDate },
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: events.length, unit: "facilities", comparedTo: `${history.snapshotCount} real pulls, ${history.daysOfHistory} day(s) of history` },
    drivers: [
      {
        description:
          events.length === 0
            ? `Real diffRows() comparison (facility_id) across every consecutive pair of the ${history.snapshotCount} real pulls collected so far found no added or removed facility_id.`
            : `Real facility ${eventNounPlural}, most recent first: ${[...events].reverse().map((e) => `${e.facilityName} (${e.state}), first observed between ${e.observedBetween.from} and ${e.observedBetween.to}`).join("; ")}.`,
        supportingEvidenceIds: ["ev-hgi-facility-changes"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      eventNoun === "entry"
        ? "A real facility entry (Q042) is a market-expansion signal worth an executive's attention - new capacity entering a market can affect network-adequacy and competitive positioning."
        : "A real facility exit (Q043) is an access-risk signal worth an executive's attention - lost capacity can affect network adequacy and shift utilization to remaining facilities.",
    evidence: [
      {
        id: "ev-hgi-facility-changes",
        sourceId: SOURCE_ID,
        description: `CMS Hospital General Information, real facility_id diff across ${history.snapshotCount} real pulls, ${history.earliestDate} to ${history.latestDate}`,
        datasetVintage: history.latestDate,
      },
    ],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Based on ${history.snapshotCount} real snapshot(s) spanning ${history.daysOfHistory} day(s) (TREND_FRAMEWORK.md's full baseline window is 730 days); this CMS dataset itself refreshes quarterly, so a real entry/exit is not expected at a sub-quarterly cadence regardless of pull frequency.`,
    freshness: { dataAsOf: history.latestDate, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      `Bounded to what this project has actually observed across ${history.snapshotCount} real pull(s) spanning ${history.daysOfHistory} real day(s) - CMS itself does not publish a historical archive of past Hospital General Information vintages via its live datastore API (verified 2026-09-24), so entries/exits from before this project's own first real pull cannot be recovered retroactively; this list can only grow from here as real future pulls accumulate.`,
      "A facility disappearing from this dataset means it stopped appearing in CMS's own published file - it does not by itself confirm the facility physically closed (e.g. a real ownership/ID change could also cause this), and a facility appearing does not by itself confirm a genuinely new physical location rather than a reporting change.",
      "Never a claim about why a facility entered or exited - only that its real facility_id appeared or disappeared between two real pulls.",
    ],
    nextSignal: "Watch for the first real facility_id addition or removal across a future pull - that would be this signal's first genuine, non-zero observation.",
    recommendedInternalValidation: "Confirm any specific facility change here against internal network-adequacy or provider-directory data before acting on it.",
    sourceIds: [SOURCE_ID],
    generatingAgent: AGENT_ID,
  };

  return validateInsight(insight);
}

function buildFacilityEntriesSignal(changes: AccumulatedFacilityChanges, history: SnapshotHistoryAssessment): Insight | null {
  return buildFacilityChangeSignal(changes.entries, "entry", "Q042", history);
}

function buildFacilityExitsSignal(changes: AccumulatedFacilityChanges, history: SnapshotHistoryAssessment): Insight | null {
  return buildFacilityChangeSignal(changes.exits, "exit", "Q043", history);
}
