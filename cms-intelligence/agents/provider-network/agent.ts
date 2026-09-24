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
 */
import {
  listSnapshotFiles,
  loadSnapshot,
  SOURCE_ID,
} from "../../data/adapters/hospitalGeneralInformation";
import { assessSnapshotHistory, dateFromSnapshotFilename, directionsAcrossSnapshots } from "../../data/sources/snapshotHistory";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { concentrationRatio } from "../../intelligence/metrics/metrics";
import { classifyConfidence, meetsPersistence } from "../../intelligence/trends/trend";
import type { AgentContext, DomainAgent } from "../types";

const AGENT_ID = "provider-network-intelligence";
const TOP_N_OWNERSHIP_TYPES = 4;

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
  questionIds: ["Q036", "Q037", "Q038"],

  async run(_ctx: AgentContext): Promise<Insight[]> {
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

    const CHART_TOP_N = 5;
    const chartTop = ranked.slice(0, CHART_TOP_N);
    const chartOtherCount = ranked.slice(CHART_TOP_N).reduce((sum, [, count]) => sum + count, 0);

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
          description: `Ownership-type distribution across ${ranked.length} distinct categories. CR${TOP_N_OWNERSHIP_TYPES} across ${history.snapshotCount} real pulls: ${cr4Series.map((v) => v.toFixed(1)).join(" → ")}%.`,
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

    return [validateInsight(insight)];
  },
};
