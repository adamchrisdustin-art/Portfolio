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
    <div>
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
