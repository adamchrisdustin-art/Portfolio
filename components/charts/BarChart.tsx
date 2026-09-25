import type { ChartBar } from "@/cms-intelligence/intelligence/evidence/schema";
import {
  CHART_CENTERED_CHILD_STYLE,
  CHART_SCROLL_WRAPPER_STYLE,
  CHART_TITLE_STYLE,
  GRIDLINE,
  INK_PRIMARY,
  INK_SECONDARY,
  MAGNITUDE_HUE,
} from "./chartTheme";

/**
 * Horizontal bar chart - magnitude comparison, single hue (sequential
 * color job per the dataviz skill), real data only. Mark spec: 20px
 * bars (under the skill's 24px cap), 4px rounded data-end square at the
 * baseline, 2px surface gap between bars, hairline gridline, value
 * labeled at the tip. Native <title> gives a hover tooltip without a
 * client-side JS dependency.
 *
 * Label column width is computed from the actual longest label rather
 * than a fixed guess - a fixed 64px column clipped real labels like
 * "Diagnostic Radiology" off the left edge of the SVG (caught from a
 * screenshot Adam sent of the live page - a real bug, not a hypothetical
 * one). The chart is wrapped in a horizontally scrollable, centered
 * container so a chart that's still wider than its card scrolls instead
 * of clipping or overflowing the card's edge.
 */
export default function BarChart({ chart }: { chart: ChartBar }) {
  if (chart.orientation === "vertical") return <ColumnChart chart={chart} />;
  const barHeight = 20;
  const gap = 2;
  const rowHeight = barHeight + gap;
  const fontSize = 11;
  // Rough but reliable monospace-independent width estimate for this
  // site's sans font at 11px - avoids a canvas/DOM measurement pass for
  // a server-rendered component, and errs generous rather than tight.
  const estimateTextWidth = (s: string) => s.length * (fontSize * 0.62);
  const longestLabel = Math.max(...chart.bars.map((b) => estimateTextWidth(b.label)));
  // No upper cap - a prior 180px cap clipped real long labels (e.g. real
  // legal entity names like "BlueCross BlueShield Association, Federal
  // Employee", 50 real characters / ~341px) at the SVG's own left edge,
  // since text-anchor="end" renders the overflow at a negative x-
  // coordinate outside the SVG's viewBox rather than merely requiring a
  // scroll - a real bug caught from Adam's screenshot, not a hypothetical
  // one. The chart is already horizontally scrollable, so a wider label
  // column is the correct fix, not a truncated label.
  const labelWidth = Math.max(64, Math.ceil(longestLabel) + 16);
  const longestValue = Math.max(...chart.bars.map((b) => estimateTextWidth(b.value.toLocaleString())));
  const valueSpace = Math.ceil(longestValue) + 14;
  const plotWidth = 220;
  const chartWidth = labelWidth + plotWidth + valueSpace;
  const maxValue = Math.max(...chart.bars.map((b) => b.value));
  const height = chart.bars.length * rowHeight + 8;

  return (
    <div className="chart">
      <div className="mono" style={CHART_TITLE_STYLE}>
        {chart.title}
      </div>
      <div tabIndex={0} style={CHART_SCROLL_WRAPPER_STYLE}>
        <svg
          width={chartWidth}
          height={height}
          style={CHART_CENTERED_CHILD_STYLE}
          role="img"
          aria-label={`${chart.title}: ${chart.bars.map((b) => `${b.label} ${b.value}`).join(", ")}`}
        >
          {chart.bars.map((bar, i) => {
            const barWidth = maxValue > 0 ? (bar.value / maxValue) * plotWidth : 0;
            const y = i * rowHeight;
            return (
              <g key={bar.label}>
                <title>{`${bar.label}: ${bar.value.toLocaleString()} ${chart.unit}`}</title>
                <text x={labelWidth - 8} y={y + barHeight / 2 + 4} textAnchor="end" fontSize={fontSize} fill={INK_SECONDARY}>
                  {bar.label}
                </text>
                <rect x={labelWidth} y={y} width={plotWidth} height={barHeight} fill={GRIDLINE} opacity={0.3} rx={4} />
                <rect x={labelWidth} y={y} width={Math.max(barWidth, 2)} height={barHeight} fill={MAGNITUDE_HUE} rx={4} />
                <text
                  x={labelWidth + Math.max(barWidth, 2) + 6}
                  y={y + barHeight / 2 + 4}
                  fontSize={fontSize}
                  fill={INK_PRIMARY}
                  fontFamily="var(--font-mono)"
                >
                  {bar.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

const FULL_WIDTH = 1020;
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Vertical columns, same single hue and mark spec as the bars. Value labels use compact notation
 * (e.g. 14.8M) so they fit above a narrow column; the tooltip keeps the full number. Long category
 * labels are angled rather than truncated, with the bottom margin sized from the longest one.
 */
function ColumnChart({ chart }: { chart: ChartBar }) {
  const fontSize = 11;
  const estimateTextWidth = (s: string) => s.length * (fontSize * 0.62);
  const longestLabel = Math.max(...chart.bars.map((b) => estimateTextWidth(b.label)));
  const angled = longestLabel > 22;
  const valueText = (v: number) => (Math.abs(v) >= 10000 ? compact.format(v) : v.toLocaleString(undefined, { maximumFractionDigits: 1 }));
  const longestValue = Math.max(...chart.bars.map((b) => estimateTextWidth(valueText(b.value))));
  const bottom = angled ? Math.ceil(longestLabel * 0.71) + 14 : 20;
  // A -45° label hangs left of its column, so only the first column's label needs room on the left.
  const left = angled ? Math.max(4, Math.ceil(estimateTextWidth(chart.bars[0].label) * 0.71) - 20) : 4;
  // Sized to fill a full-width Data Explorer panel; narrower screens scroll.
  const slot = Math.max(Math.ceil(longestValue) + 8, 20, Math.floor((FULL_WIDTH - left - 8) / chart.bars.length));
  const columnWidth = Math.min(56, Math.max(16, Math.ceil(longestValue) + 4, Math.floor(slot * 0.6)));
  const gap = slot - columnWidth;
  const plotHeight = 160;
  const top = 16;
  const width = left + chart.bars.length * slot + 4;
  const height = top + plotHeight + bottom;
  const maxValue = Math.max(...chart.bars.map((b) => b.value));
  const baseline = top + plotHeight;

  return (
    <div className="chart">
      <div className="mono" style={CHART_TITLE_STYLE}>
        {chart.title}
      </div>
      <div tabIndex={0} style={CHART_SCROLL_WRAPPER_STYLE}>
        <svg
          width={width}
          height={height}
          style={CHART_CENTERED_CHILD_STYLE}
          role="img"
          aria-label={`${chart.title}: ${chart.bars.map((b) => `${b.label} ${b.value}`).join(", ")}`}
        >
          <line x1={left} x2={width - 4} y1={baseline} y2={baseline} stroke={GRIDLINE} strokeWidth={1} />
          {chart.bars.map((bar, i) => {
            const h = maxValue > 0 ? Math.max((bar.value / maxValue) * plotHeight, bar.value > 0 ? 2 : 0) : 0;
            const x = left + i * slot + gap / 2;
            const cx = x + columnWidth / 2;
            return (
              <g key={bar.label}>
                <title>{`${bar.label}: ${bar.value.toLocaleString()} ${chart.unit}`}</title>
                <rect x={x} y={top} width={columnWidth} height={plotHeight} fill={GRIDLINE} opacity={0.3} rx={4} />
                {h > 0 && <rect x={x} y={baseline - h} width={columnWidth} height={h} fill={MAGNITUDE_HUE} rx={4} />}
                <text x={cx} y={baseline - h - 4} textAnchor="middle" fontSize={fontSize - 1} fill={INK_PRIMARY} fontFamily="var(--font-mono)">
                  {valueText(bar.value)}
                </text>
                {angled ? (
                  <text x={cx} y={baseline + 12} textAnchor="end" fontSize={fontSize} fill={INK_SECONDARY} transform={`rotate(-45 ${cx} ${baseline + 12})`}>
                    {bar.label}
                  </text>
                ) : (
                  <text x={cx} y={baseline + 14} textAnchor="middle" fontSize={fontSize} fill={INK_SECONDARY}>
                    {bar.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
