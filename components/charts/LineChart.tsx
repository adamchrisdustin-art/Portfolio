import type { InsightSeries } from "@/cms-intelligence/intelligence/evidence/schema";
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
 * Full-size time-series line chart - the promoted, prominent version of
 * Sparkline.tsx for the Data Explorer section. Real points only. Reads
 * cleanly from a few points up to a few dozen: past 6 points only the
 * first, middle and last dates are labeled, and large values use compact
 * notation. Single series - per the dataviz skill, a single series needs
 * no legend, the title already names it.
 */
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const formatValue = (v: number) => (Math.abs(v) >= 10000 ? compact.format(v) : v.toLocaleString(undefined, { maximumFractionDigits: 1 }));
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
  const n = series.points.length;
  const labeled = n > 6 ? new Set([0, Math.floor((n - 1) / 2), n - 1]) : null;
  const spansYears = n > 0 && series.points[0].date.slice(0, 4) !== series.points[n - 1].date.slice(0, 4);
  const allYearEnd = series.points.every((p) => p.date.endsWith("-12-31"));
  const dateLabel = (d: string) => (allYearEnd && spansYears ? d.slice(0, 4) : spansYears ? d.slice(0, 7) : d.slice(5));
  const pointRadius = n > 12 ? 3 : 5;

  return (
    <div className="chart">
      <div className="mono" style={CHART_TITLE_STYLE}>
        {series.label} ({series.points.length} real pull{series.points.length === 1 ? "" : "s"})
      </div>
      <div tabIndex={0} style={CHART_SCROLL_WRAPPER_STYLE}>
      <svg width={width} height={height} style={CHART_CENTERED_CHILD_STYLE} role="img" aria-label={`${series.label}: ${series.points.map((p) => `${p.date} ${p.value}`).join(", ")}`}>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(tick)} y2={yFor(tick)} stroke={GRIDLINE} strokeWidth={1} />
            <text x={padding.left - 8} y={yFor(tick) + 3} textAnchor="end" fontSize="10" fill={INK_SECONDARY}>
              {formatValue(tick)}
            </text>
          </g>
        ))}
        <path d={pathD} stroke={MAGNITUDE_HUE} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {series.points.map((p, i) => (
          <g key={p.date}>
            <circle cx={xFor(i)} cy={yFor(p.value)} r={pointRadius} fill={MAGNITUDE_HUE} stroke="var(--surface)" strokeWidth={2}>
              <title>{`${p.date}: ${p.value.toLocaleString()} ${series.unit}`}</title>
            </circle>
            {(!labeled || labeled.has(i)) && (
              <text x={xFor(i)} y={height - padding.bottom + 16} textAnchor={labeled && i === n - 1 ? "end" : labeled && i === 0 ? "start" : "middle"} fontSize="10" fill={INK_SECONDARY}>
                {dateLabel(p.date)}
              </text>
            )}
          </g>
        ))}
        {series.points.length > 0 && (
          <text x={xFor(series.points.length - 1)} y={yFor(series.points[series.points.length - 1].value) - 10} textAnchor="end" fontSize="11" fontWeight={600} fill={INK_PRIMARY}>
            {formatValue(series.points[series.points.length - 1].value)}
          </text>
        )}
      </svg>
      </div>
    </div>
  );
}
