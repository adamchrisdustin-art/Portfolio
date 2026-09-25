import type { ChartBoxPlot } from "@/cms-intelligence/intelligence/evidence/schema";
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
 * Box-and-whisker plot, one box per category (e.g. per state) - real
 * quartiles only, computed from actual per-record values (see the
 * generating agent for the computation), never estimated. Whiskers use
 * the standard Tukey convention (1.5x IQR), not the raw sample min/max -
 * a single outlier would otherwise stretch the axis and flatten every
 * other box. Real values beyond the whisker are plotted as individual
 * outlier points, never discarded. Single hue per the dataviz skill's
 * magnitude-comparison rule - category identity comes from the x-axis
 * label, not color.
 *
 * Y-axis domain is computed from the whisker range only, not from
 * outlier values - a real bug (caught from a screenshot: one 5.27
 * outlier squashed every box's real IQR detail into an unreadable
 * sliver near the axis floor). An outlier beyond the visible domain is
 * clamped to the plot edge and rendered as a triangle (not a circle,
 * which is reserved for an in-range outlier) so it reads as "pinned, not
 * literal" - its real value is still disclosed via a per-point <title>
 * tooltip, never hidden just because it's off the visible scale.
 */
export default function BoxPlot({ chart }: { chart: ChartBoxPlot }) {
  // Many-category plots (e.g. 20+ states) fill a full-width panel so their labels don't collide.
  const width = chart.boxes.length > 8 ? Math.max(1020, 52 + chart.boxes.length * 36) : 360;
  const height = 200;
  const padding = { top: 12, right: 12, bottom: 24, left: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const whiskerValues = chart.boxes.flatMap((b) => [b.whiskerLow, b.whiskerHigh]);
  const whiskerMin = Math.min(...whiskerValues);
  const whiskerMax = Math.max(...whiskerValues);
  const whiskerRange = whiskerMax - whiskerMin || 1;
  const domainPadding = whiskerRange * 0.15;
  const domainMin = whiskerMin - domainPadding;
  const domainMax = whiskerMax + domainPadding;
  const domainRange = domainMax - domainMin || 1;
  const yFor = (v: number) => padding.top + plotHeight * (1 - (v - domainMin) / domainRange);
  const isOffScale = (v: number) => v < domainMin || v > domainMax;
  const clampedY = (v: number) => Math.min(Math.max(yFor(v), padding.top), padding.top + plotHeight);

  const boxWidth = 28;
  const slotWidth = plotWidth / chart.boxes.length;

  const yTicks = [domainMin, domainMin + domainRange / 2, domainMax];
  const hasOutliers = chart.boxes.some((b) => b.outliers.length > 0);
  const hasOffScaleOutliers = chart.boxes.some((b) => b.outliers.some(isOffScale));

  return (
    <div className="chart">
      <div className="mono" style={CHART_TITLE_STYLE}>
        {chart.title}
        {hasOutliers && " (dots = outliers beyond 1.5×IQR"}
        {hasOffScaleOutliers && ", triangles = outliers off this chart's visible scale, see tooltip for the real value"}
        {hasOutliers && ")"}
      </div>
      <div tabIndex={0} style={CHART_SCROLL_WRAPPER_STYLE}>
      <svg
        width={width}
        height={height}
        style={CHART_CENTERED_CHILD_STYLE}
        role="img"
        aria-label={`${chart.title}: ${chart.boxes.map((b) => `${b.label} median ${b.median}${b.outliers.length ? `, outliers ${b.outliers.join(", ")}` : ""}`).join(", ")}`}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(tick)} y2={yFor(tick)} stroke={GRIDLINE} strokeWidth={1} />
            <text x={padding.left - 6} y={yFor(tick) + 3} textAnchor="end" fontSize="10" fill={INK_SECONDARY}>
              {tick.toFixed(2)}
            </text>
          </g>
        ))}

        {chart.boxes.map((box) => {
          const i = chart.boxes.indexOf(box);
          const cx = padding.left + slotWidth * i + slotWidth / 2;
          return (
            <g key={box.label}>
              <title>{`${box.label}: median ${box.median.toFixed(2)}, IQR ${box.q1.toFixed(2)}–${box.q3.toFixed(2)}, whiskers ${box.whiskerLow.toFixed(2)}–${box.whiskerHigh.toFixed(2)}${box.outliers.length ? `, outliers: ${box.outliers.map((v) => v.toFixed(2)).join(", ")}` : ""} (n=${box.sampleSize})`}</title>
              <line x1={cx} x2={cx} y1={yFor(box.whiskerHigh)} y2={yFor(box.whiskerLow)} stroke={MAGNITUDE_HUE} strokeWidth={2} />
              <rect
                x={cx - boxWidth / 2}
                y={yFor(box.q3)}
                width={boxWidth}
                height={Math.max(yFor(box.q1) - yFor(box.q3), 1)}
                fill={MAGNITUDE_HUE}
                fillOpacity={0.25}
                stroke={MAGNITUDE_HUE}
                strokeWidth={2}
              />
              <line x1={cx - boxWidth / 2} x2={cx + boxWidth / 2} y1={yFor(box.median)} y2={yFor(box.median)} stroke={MAGNITUDE_HUE} strokeWidth={2} />
              {box.outliers.map((v, oi) =>
                isOffScale(v) ? (
                  <polygon
                    key={oi}
                    points={`${cx - 4},${clampedY(v) + (v > domainMax ? 6 : -6)} ${cx + 4},${clampedY(v) + (v > domainMax ? 6 : -6)} ${cx},${clampedY(v)}`}
                    fill={MAGNITUDE_HUE}
                    stroke="var(--surface)"
                    strokeWidth={1}
                  >
                    <title>{`${box.label} outlier (off this chart's visible scale): ${v.toFixed(2)}`}</title>
                  </polygon>
                ) : (
                  <circle key={oi} cx={cx} cy={yFor(v)} r={3} fill="var(--surface)" stroke={MAGNITUDE_HUE} strokeWidth={1.5}>
                    <title>{`${box.label} outlier: ${v.toFixed(2)}`}</title>
                  </circle>
                )
              )}
              <text x={cx} y={height - padding.bottom + 16} textAnchor="middle" fontSize="11" fill={INK_PRIMARY}>
                {box.label}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}

