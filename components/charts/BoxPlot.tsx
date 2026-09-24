import type { ChartBoxPlot } from "@/cms-intelligence/intelligence/evidence/schema";
import { GRIDLINE, INK_PRIMARY, INK_SECONDARY, MAGNITUDE_HUE } from "./chartTheme";

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
 */
export default function BoxPlot({ chart }: { chart: ChartBoxPlot }) {
  const width = 360;
  const height = 200;
  const padding = { top: 12, right: 12, bottom: 24, left: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const allValues = chart.boxes.flatMap((b) => [b.whiskerLow, b.whiskerHigh, ...b.outliers]);
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const range = dataMax - dataMin || 1;
  const yFor = (v: number) => padding.top + plotHeight * (1 - (v - dataMin) / range);

  const boxWidth = 28;
  const slotWidth = plotWidth / chart.boxes.length;

  const yTicks = [dataMin, dataMin + range / 2, dataMax];
  const hasOutliers = chart.boxes.some((b) => b.outliers.length > 0);

  return (
    <div>
      <div className="mono" style={{ fontSize: "0.72rem", color: INK_SECONDARY, marginBottom: 6 }}>
        {chart.title}
        {hasOutliers && " (dots = outliers beyond 1.5×IQR)"}
      </div>
      <div style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
      <svg
        width={width}
        height={height}
        style={{ flexShrink: 0 }}
        role="img"
        aria-label={`${chart.title}: ${chart.boxes.map((b) => `${b.label} median ${b.median}`).join(", ")}`}
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
              <title>{`${box.label}: median ${box.median.toFixed(2)}, IQR ${box.q1.toFixed(2)}–${box.q3.toFixed(2)}, whiskers ${box.whiskerLow.toFixed(2)}–${box.whiskerHigh.toFixed(2)}${box.outliers.length ? `, ${box.outliers.length} outlier(s)` : ""} (n=${box.sampleSize})`}</title>
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
              {box.outliers.map((v, oi) => (
                <circle key={oi} cx={cx} cy={yFor(v)} r={3} fill="var(--surface)" stroke={MAGNITUDE_HUE} strokeWidth={1.5} />
              ))}
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
