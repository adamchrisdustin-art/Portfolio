/**
 * Canonical Insight schema - see docs/cms-intelligence/EVIDENCE_MODEL.md
 * for the full design rationale. This file is that document's TypeScript
 * implementation; keep them in sync if either changes.
 */

export type SignalType = "trend" | "anomaly" | "policy" | "structural-change" | "baseline";
export type ConfidenceLevel = "low" | "medium" | "high";
export type PopulationType =
  | "medicare-ffs"
  | "medicare-advantage"
  | "part-d"
  | "medicaid"
  | "chip"
  | "dual-eligible"
  | "marketplace"
  | "cross-population"
  | "n/a";

export interface Period {
  start: string; // ISO date
  end: string; // ISO date
  isComparisonWindow?: boolean;
}

export interface Geography {
  level: "national" | "state" | "county" | "cbsa" | "hrr" | "rating-area" | "plan-service-area";
  code: string;
  label: string;
}

export interface Magnitude {
  value: number;
  unit: string;
  comparedTo?: string;
  delta?: number;
  deltaPercent?: number;
}

export interface SeriesPoint {
  date: string; // ISO date - the real snapshot vintage this point came from
  value: number;
}

/**
 * Optional real time-series backing a chart. Only ever populated from
 * actual snapshot history (see cms-intelligence/data/sources/
 * snapshotHistory.ts) - never fabricated or interpolated. Absent when
 * fewer than 2 real snapshots exist yet, which is most agents most of
 * the time until this project accumulates more history.
 */
export interface InsightSeries {
  label: string;
  unit: string;
  points: SeriesPoint[];
}

/**
 * Cross-sectional chart data - added after Adam pointed out that "not
 * enough history for a trend chart" (the reasoning behind InsightSeries
 * being sparse) doesn't apply to bar/donut/boxplot charts, which
 * visualize a single real snapshot's distribution and make no trend
 * claim at all. Only ever populated from real computed values - never
 * fabricated or interpolated, same discipline as InsightSeries.
 */
export interface ChartBarDatum {
  label: string;
  value: number;
}
export interface ChartBar {
  type: "bar";
  title: string;
  unit: string;
  bars: ChartBarDatum[]; // pre-sorted in display order
}

export interface ChartDonutDatum {
  label: string;
  value: number;
}
export interface ChartDonut {
  type: "donut";
  title: string;
  unit: string;
  slices: ChartDonutDatum[]; // pre-sorted, "Other" (if present) last
}

export interface ChartBoxDatum {
  label: string;
  /** Tukey whisker (1.5x IQR from q1), not the raw sample minimum - see BoxPlot's generating agent. */
  whiskerLow: number;
  q1: number;
  median: number;
  q3: number;
  /** Tukey whisker (1.5x IQR from q3), not the raw sample maximum. */
  whiskerHigh: number;
  /** Real values beyond the Tukey whiskers, plotted as individual points rather than stretching the axis. */
  outliers: number[];
  sampleSize: number;
}
export interface ChartBoxPlot {
  type: "boxplot";
  title: string;
  unit: string;
  boxes: ChartBoxDatum[];
}

export type InsightChart = ChartBar | ChartDonut | ChartBoxPlot;

export interface Driver {
  description: string;
  supportingEvidenceIds: string[];
  relationship: "correlation" | "stated-mechanism" | "confirmed-causal";
}

export interface EvidenceRef {
  id: string;
  sourceId: string;
  description: string;
  datasetVintage: string; // ISO date
  url?: string;
}

export interface Freshness {
  dataAsOf: string; // ISO date
  generatedAt: string; // ISO datetime
  isStale: boolean;
}

export interface Insight {
  id: string;
  headline: string;
  questionId: string;
  signalType: SignalType;
  period: Period;
  population: PopulationType;
  geography: Geography;
  magnitude: Magnitude;
  drivers: Driver[];
  businessRelevance: string;
  evidence: EvidenceRef[];
  contradictoryEvidence: EvidenceRef[];
  confidence: ConfidenceLevel;
  confidenceRationale: string;
  freshness: Freshness;
  limitations: string[];
  nextSignal: string;
  recommendedInternalValidation: string;
  sourceIds: string[];
  generatingAgent: string;
  /** Present only when real multi-snapshot history backs a chart - see InsightSeries. */
  series?: InsightSeries;
  /** Present only when real cross-sectional data backs a bar/donut/boxplot - see InsightChart. */
  chart?: InsightChart;
}
