import type { ChartDonut } from "@/cms-intelligence/intelligence/evidence/schema";
import { CATEGORICAL, CHART_TITLE_STYLE, INK_PRIMARY, INK_SECONDARY } from "./chartTheme";

function arcPath(cx: number, cy: number, r: number, innerR: number, startAngle: number, endAngle: number): string {
  const toXY = (radius: number, angle: number) => [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  const [x1, y1] = toXY(r, startAngle);
  const [x2, y2] = toXY(r, endAngle);
  const [x3, y3] = toXY(innerR, endAngle);
  const [x4, y4] = toXY(innerR, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}

/**
 * Donut chart - part-to-whole/identity (categorical color job per the
 * dataviz skill), real data only. Legend always present for 2+ slices
 * (skill rule); direct labels only where a slice is wide enough to hold
 * one without crowding. 2px surface gap between slices via a stroke in
 * the card background color, matching the "surface gap" spacer spec.
 */
export default function DonutChart({ chart }: { chart: ChartDonut }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const innerR = r * 0.6;
  const total = chart.slices.reduce((s, v) => s + v.value, 0);

  let angle = -Math.PI / 2;
  const slicesWithAngles = chart.slices.map((slice, i) => {
    const fraction = total > 0 ? slice.value / total : 0;
    const startAngle = angle;
    const endAngle = angle + fraction * Math.PI * 2;
    angle = endAngle;
    return { ...slice, startAngle, endAngle, fraction, color: CATEGORICAL[i % CATEGORICAL.length] };
  });

  return (
    <div className="chart">
      <div className="mono" style={CHART_TITLE_STYLE}>
        {chart.title}
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "center", flexWrap: "wrap", width: "100%" }}>
        <svg
          width={size}
          height={size}
          style={{ flexShrink: 0 }}
          role="img"
          aria-label={`${chart.title}: ${chart.slices.map((s) => `${s.label} ${s.value}`).join(", ")}`}
        >
          {slicesWithAngles.map((slice) => (
            <path
              key={slice.label}
              d={arcPath(cx, cy, r, innerR, slice.startAngle, slice.endAngle)}
              fill={slice.color}
              stroke="var(--surface)"
              strokeWidth={2}
            >
              <title>{`${slice.label}: ${slice.value.toLocaleString()} ${chart.unit} (${(slice.fraction * 100).toFixed(1)}%)`}</title>
            </path>
          ))}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.78rem", minWidth: 0, maxWidth: 220 }}>
          {slicesWithAngles.map((slice) => (
            <div key={slice.label} style={{ display: "flex", alignItems: "start", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: slice.color, flexShrink: 0, marginTop: 3 }} />
              <span style={{ color: INK_PRIMARY, wordBreak: "break-word" }}>{slice.label}</span>
              <span className="mono" style={{ color: INK_SECONDARY, flexShrink: 0, marginLeft: "auto" }}>
                {(slice.fraction * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
