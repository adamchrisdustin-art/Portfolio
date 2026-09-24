import type { InsightSeries } from "@/cms-intelligence/intelligence/evidence/schema";
import { GRIDLINE, INK_PRIMARY, INK_SECONDARY, MAGNITUDE_HUE } from "./chartTheme";

/**
 * Full-size time-series line chart - the promoted, prominent version of
 * Sparkline.tsx for the Data Explorer section. Real snapshot-backed
 * points only. Only 2-3 real points exist as of this writing (this
 * project's own quarterly pull cadence, see COST_AND_OPERATING_MODEL.md)
 * - the chart is intentionally built to read cleanly with few points and
 * get more informative as real history accumulates, not redesigned later.
 * Single series - per the dataviz skill, a single series needs no legend,
 * the title already names it.
 */
export default function LineChart({ series }: { series: InsightSeries }) {
  const width = 400;
  const height = 200;
  const padding = { top: 16, right: 16, bottom: 28, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = series.points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.max(1, Math.abs(max) * 0.1 || 1);
  const yMin = min - range * 0.15;
  const yMax = max + range * 0.15;
  const yRange = yMax - yMin || 1;

  const xFor = (i: number) => padding.left + (series.points.length > 1 ? (i / (series.points.length - 1)) * plotWidth : plotWidth / 2);
  const yFor = (v: number) => padding.top + plotHeight * (1 - (v - yMin) / yRange);

  const pathD = series.points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(p.value).toFixed(1)}`).join(" ");
  const yTicks = [yMin + yRange * 0.1, yMin + yRange * 0.5, yMin + yRange * 0.9];

  return (
    <div>
      <div className="mono" style={{ fontSize: "0.78rem", color: INK_SECONDARY, marginBottom: 6 }}>
        {series.label} ({series.points.length} real pull{series.points.length === 1 ? "" : "s"})
      </div>
      <div style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
      <svg width={width} height={height} style={{ flexShrink: 0 }} role="img" aria-label={`${series.label}: ${series.points.map((p) => `${p.date} ${p.value}`).join(", ")}`}>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(tick)} y2={yFor(tick)} stroke={GRIDLINE} strokeWidth={1} />
            <text x={padding.left - 8} y={yFor(tick) + 3} textAnchor="end" fontSize="10" fill={INK_SECONDARY}>
              {tick.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </text>
          </g>
        ))}
        <path d={pathD} stroke={MAGNITUDE_HUE} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {series.points.map((p, i) => (
          <g key={p.date}>
            <circle cx={xFor(i)} cy={yFor(p.value)} r={5} fill={MAGNITUDE_HUE} stroke="var(--surface)" strokeWidth={2}>
              <title>{`${p.date}: ${p.value.toLocaleString()} ${series.unit}`}</title>
            </circle>
            <text x={xFor(i)} y={height - padding.bottom + 16} textAnchor="middle" fontSize="10" fill={INK_SECONDARY}>
              {p.date.slice(5)}
            </text>
          </g>
        ))}
        {series.points.length > 0 && (
          <text x={xFor(series.points.length - 1)} y={yFor(series.points[series.points.length - 1].value) - 10} textAnchor="middle" fontSize="11" fontWeight={600} fill={INK_PRIMARY}>
            {series.points[series.points.length - 1].value.toLocaleString()}
          </text>
        )}
      </svg>
      </div>
    </div>
  );
}
