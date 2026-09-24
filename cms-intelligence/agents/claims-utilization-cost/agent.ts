/**
 * Claims, Utilization & Cost Intelligence agent - see
 * docs/cms-intelligence/AGENT_ARCHITECTURE.md section 3.
 *
 * Wired to the real, live-pulled CMS Home Health Care Agencies dataset
 * (see cms-intelligence/data/adapters/homeHealthCareAgencies.ts). The
 * field CMS calls "how much Medicare spends on an episode of care at
 * this agency" is a risk-adjusted spending RATIO (actual vs. expected
 * episode cost, ~1.0 = as expected), not a raw dollar figure - do not
 * relabel it as a dollar cost-per-episode number.
 *
 * Confidence and signalType are computed dynamically from real snapshot
 * history (cms-intelligence/data/sources/snapshotHistory.ts), same
 * pattern as market-growth and provider-network. As of 2026-09-23 only
 * one real snapshot exists (a same-day re-pull overwrites rather than
 * adding a new dated snapshot - see pull-home-health.ts), so this
 * correctly reports "baseline"/"low" until a second real pull on a
 * later calendar day exists - not a code limitation.
 */
import { listSnapshotFiles, loadSnapshot, SOURCE_ID } from "../../data/adapters/homeHealthCareAgencies";
import { assessSnapshotHistory, dateFromSnapshotFilename, directionsAcrossSnapshots } from "../../data/sources/snapshotHistory";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { tukeyBox } from "../../intelligence/metrics/metrics";
import { classifyConfidence, meetsPersistence } from "../../intelligence/trends/trend";
import type { AgentContext, DomainAgent } from "../types";

const AGENT_ID = "claims-utilization-cost-intelligence";
const RATIO_FIELD = "how_much_medicare_spends_on_an_episode_of_care_at_this_agen_56e6";
const BOXPLOT_TOP_N_STATES = 6;
const MIN_AGENCIES_FOR_BOXPLOT = 30; // enough for a meaningful quartile read

function meanRatioFor(rows: Record<string, unknown>[]): { mean: number; validCount: number; suppressedCount: number } {
  const values: number[] = [];
  for (const row of rows) {
    const raw = row[RATIO_FIELD];
    if (typeof raw !== "string") continue;
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) values.push(parsed);
  }
  const mean = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : NaN;
  return { mean, validCount: values.length, suppressedCount: rows.length - values.length };
}

export interface BoxplotState {
  label: string;
  whiskerLow: number;
  q1: number;
  median: number;
  q3: number;
  whiskerHigh: number;
  outliers: number[];
  sampleSize: number;
}

/** Exported for reuse by the Data Explorer analytics section - see cms-intelligence/analytics/overview.ts. */
export function boxplotByState(rows: { state: string; [key: string]: unknown }[]): BoxplotState[] {
  const byState = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.state) continue;
    const raw = row[RATIO_FIELD];
    if (typeof raw !== "string") continue;
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) continue;
    if (!byState.has(row.state)) byState.set(row.state, []);
    byState.get(row.state)!.push(parsed);
  }

  const withEnoughData = Array.from(byState.entries()).filter(([, values]) => values.length >= MIN_AGENCIES_FOR_BOXPLOT);
  const topByCount = withEnoughData.sort((a, b) => b[1].length - a[1].length).slice(0, BOXPLOT_TOP_N_STATES);

  return topByCount
    .map(([state, values]) => ({ label: state, ...tukeyBox(values) }))
    .sort((a, b) => a.median - b.median);
}

export const claimsUtilizationCostAgent: DomainAgent = {
  id: AGENT_ID,
  questionIds: ["Q011", "Q012", "Q013", "Q014", "Q015", "Q016", "Q017", "Q018", "Q019", "Q020", "Q021", "Q022", "Q023", "Q024", "Q025"],

  async run(_ctx: AgentContext): Promise<Insight[]> {
    const files = listSnapshotFiles();
    if (files.length === 0) return [];

    const snapshots = files.map((f) => ({ date: dateFromSnapshotFilename(f), snapshot: loadSnapshot(f) }));
    const latest = snapshots[snapshots.length - 1].snapshot;
    if (latest.rows.length === 0) return [];

    const history = assessSnapshotHistory(snapshots.map((s) => s.date));
    const ratioStats = snapshots.map((s) => meanRatioFor(s.snapshot.rows as unknown as Record<string, unknown>[]));
    const latestStats = ratioStats[ratioStats.length - 1];
    if (Number.isNaN(latestStats.mean)) return []; // every value suppressed/unavailable - nothing honest to report

    const meanSeries = ratioStats.filter((r) => !Number.isNaN(r.mean)).map((r) => r.mean);
    const directions = directionsAcrossSnapshots(meanSeries);
    const confidence = classifyConfidence({
      persistenceMet: meetsPersistence(directions),
      hasFullBaseline: history.hasFullBaseline,
      hasExternalCorroboration: false,
    });

    const signalType = meetsPersistence(directions) ? "trend" : "baseline";
    const headline =
      signalType === "trend"
        ? `The average risk-adjusted Medicare spending ratio for home health episodes has moved ${directions[directions.length - 1]} across the last ${history.snapshotCount} real pulls.`
        : `The average risk-adjusted Medicare spending ratio for home health episodes is ${latestStats.mean.toFixed(2)} across ${latestStats.validCount} agencies with reported data (1.0 = spending as risk-adjusted expected).`;

    const insight: Insight = {
      id: `sig-claims-cost-${history.latestDate}-home-health-spending-ratio`,
      headline,
      questionId: "Q012",
      signalType,
      period: { start: history.earliestDate, end: history.latestDate },
      population: "medicare-ffs",
      geography: { level: "national", code: "US", label: "United States" },
      magnitude: {
        value: latestStats.mean,
        unit: "ratio-vs-risk-adjusted-expected",
        comparedTo: "risk-adjusted expected episode spending (CMS benchmark = 1.0)",
        delta: latestStats.mean - 1,
      },
      drivers: [
        {
          description: `Computed from ${latestStats.validCount} agencies reporting this measure; ${latestStats.suppressedCount} excluded (suppressed/unavailable), never imputed. Mean across ${history.snapshotCount} real pull(s): ${meanSeries.map((v) => v.toFixed(2)).join(" → ")}.`,
          supportingEvidenceIds: ["ev-hh-snapshot"],
          relationship: "correlation",
        },
      ],
      businessRelevance:
        signalType === "trend"
          ? "A real, multi-pull shift in home-health episode spending efficiency - worth checking what's driving it."
          : "A national baseline for home-health episode spending efficiency, directly comparable to CMS's own published national benchmark of 1.0.",
      evidence: [
        {
          id: "ev-hh-snapshot",
          sourceId: SOURCE_ID,
          description: `CMS Home Health Care Agencies, ${history.snapshotCount} real snapshot(s) from ${history.earliestDate} to ${history.latestDate}`,
          datasetVintage: history.latestDate,
        },
      ],
      contradictoryEvidence: [],
      confidence: confidence.level,
      confidenceRationale: `${confidence.rationale} Based on ${history.snapshotCount} real snapshot(s) spanning ${history.daysOfHistory} day(s) (TREND_FRAMEWORK.md's full baseline window is 730 days).`,
      freshness: { dataAsOf: history.latestDate, generatedAt: new Date().toISOString(), isStale: false },
      limitations: [
        "This is a risk-adjusted ratio published by CMS, not a raw dollar cost-per-episode figure.",
        `${latestStats.suppressedCount} of ${latest.rows.length} agencies had suppressed/unavailable data for this measure and are excluded from the average.`,
        `Baseline window is ${history.daysOfHistory} real day(s) so far, well short of the 24-month window this framework requires for full confidence - same-day re-pulls overwrite rather than adding history (see homeHealthCareAgencies.ts), so this grows only as real calendar days pass between pulls.`,
      ],
      nextSignal: "Watch subsequent real pulls (on later calendar days) for this ratio's distribution to shift, and for state-level variation once geography-level aggregation is added.",
      recommendedInternalValidation: "Not applicable - this is public aggregate data, not tied to any specific payer's claims experience.",
      sourceIds: [SOURCE_ID],
      generatingAgent: AGENT_ID,
      series:
        meanSeries.length >= 2
          ? {
              label: "Mean risk-adjusted home health episode spending ratio",
              unit: "ratio-vs-risk-adjusted-expected",
              points: snapshots
                .filter((_, i) => !Number.isNaN(ratioStats[i].mean))
                .map((s, i) => ({ date: s.date, value: meanSeries[i] })),
            }
          : undefined,
      chart: (() => {
        const boxes = boxplotByState(latest.rows as unknown as { state: string; [key: string]: unknown }[]);
        return boxes.length > 0
          ? { type: "boxplot" as const, title: `Spending-ratio distribution by state, top ${boxes.length} by sample size`, unit: "ratio", boxes }
          : undefined;
      })(),
    };

    return [validateInsight(insight)];
  },
};
