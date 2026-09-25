import type { ChartScatter } from "@/cms-intelligence/intelligence/evidence/schema";
import { CHART_CENTERED_CHILD_STYLE, CHART_SCROLL_WRAPPER_STYLE, CHART_TITLE_STYLE, GRIDLINE, INK_PRIMARY, INK_SECONDARY, MAGNITUDE_HUE } from "./chartTheme";

/**
 * Scatter plot - one real point per record (see ChartScatter's own
 * comment in schema.ts: never estimated/interpolated, and a chart-level
 * point cap, if the generating agent applies one, is a disclosed
 * deterministic sample, not silent truncation). Single hue per the
 * dataviz skill's magnitude-comparison rule - this shows one real
 * relationship between two continuous variables, not categorical
 * identity, so color never encodes a third dimension. Low fill opacity
 * lets real overlapping points at the same x (e.g. an integer star
 * rating) read as a denser region rather than stacking illegibly.
 */
export default function ScatterChart({ chart }: { chart: ChartScatter }) {
  const width = 360;
  const height = 220;
  const padding = { top: 12, right: 16, bottom: 32, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const xs = chart.points.map((p) => p.x);
  const ys = chart.points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const xPad = xRange * 0.1;
  const yPad = yRange * 0.1;
  const xDomainMin = xMin - xPad;
  const xDomainMax = xMax + xPad;
  const yDomainMin = yMin - yPad;
  const yDomainMax = yMax + yPad;

  const xFor = (v: number) => padding.left + plotWidth * ((v - xDomainMin) / (xDomainMax - xDomainMin));
  const yFor = (v: number) => padding.top + plotHeight * (1 - (v - yDomainMin) / (yDomainMax - yDomainMin));

  const xTicks = [xMin, (xMin + xMax) / 2, xMax];
  const yTicks = [yDomainMin, (yDomainMin + yDomainMax) / 2, yDomainMax];

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
          aria-label={`${chart.title}: ${chart.points.length} real points, ${chart.xLabel} vs ${chart.yLabel}`}
        >
          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line x1={padding.left} x2={width - padding.right} y1={yFor(tick)} y2={yFor(tick)} stroke={GRIDLINE} strokeWidth={1} />
              <text x={padding.left - 6} y={yFor(tick) + 3} textAnchor="end" fontSize="10" fill={INK_SECONDARY}>
                {tick.toFixed(1)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text key={`x-${tick}`} x={xFor(tick)} y={height - padding.bottom + 16} textAnchor="middle" fontSize="10" fill={INK_SECONDARY}>
              {tick.toFixed(1)}
            </text>
          ))}

          {chart.points.map((p, i) => (
            <circle key={i} cx={xFor(p.x)} cy={yFor(p.y)} r={3} fill={MAGNITUDE_HUE} fillOpacity={0.22} stroke="none">
              <title>{`${p.label}: ${chart.xLabel} ${p.x} ${chart.xUnit}, ${chart.yLabel} ${p.y.toFixed(1)} ${chart.yUnit}`}</title>
            </circle>
          ))}

          <text x={padding.left + plotWidth / 2} y={height - 2} textAnchor="middle" fontSize="10" fill={INK_PRIMARY}>
            {chart.xLabel}
          </text>
          <text
            x={-(padding.top + plotHeight / 2)}
            y={12}
            textAnchor="middle"
            fontSize="10"
            fill={INK_PRIMARY}
            transform="rotate(-90)"
          >
            {chart.yLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}
