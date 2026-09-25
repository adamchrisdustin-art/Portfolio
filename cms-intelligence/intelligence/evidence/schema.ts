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
  /** Vertical draws columns (categories along the bottom). Defaults to horizontal bars. */
  orientation?: "horizontal" | "vertical";
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

/**
 * Scatter plot - one real point per record (e.g. one per hospital),
 * added 2026-09-24 for the star-rating-vs-quality-outcome read (see
 * provider-network/agent.ts). Never estimated/interpolated points - a
 * dense cluster is a real finding, conveyed via point opacity at render
 * time, not by reducing the real sample.
 */
export interface ChartScatterDatum {
  label: string;
  x: number;
  y: number;
}
export interface ChartScatter {
  type: "scatter";
  title: string;
  xLabel: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
  points: ChartScatterDatum[]; // real per-record points; may be a disclosed deterministic sample of a larger real population - see the insight's own limitations, not silently truncated
}

/**
 * A linked bullet list of real named items - added 2026-09-24 after Adam
 * pointed out that a bar chart keyed by an opaque document number (e.g.
 * the upcoming-finalized-CMS-rules signal) doesn't convey the actually
 * useful content, which is "what are these rules and where can I read
 * them" - a real named list with a real source link per item, not a
 * magnitude comparison. Only for insights whose real payload is a set of
 * named things to read, not a numeric quantity to compare (bar chart
 * still owns that job).
 */
export interface ChartListItem {
  label: string; // the real item's own title/name, never a code/ID standing in for it
  detail?: string; // e.g. a real date - secondary text, not the primary label
  url?: string; // real source URL when available - never fabricated
}
export interface ChartList {
  type: "list";
  title: string;
  items: ChartListItem[];
}

export type InsightChart = ChartBar | ChartDonut | ChartBoxPlot | ChartScatter | ChartList;

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
