import type { MultiLineChartData } from "@/cms-intelligence/analytics/overview";
import {
  CATEGORICAL,
  CHART_CENTERED_CHILD_STYLE,
  CHART_SCROLL_WRAPPER_STYLE,
  CHART_TITLE_STYLE,
  GRIDLINE,
  INK_PRIMARY,
  INK_SECONDARY,
} from "./chartTheme";

/**
 * Several series on one time axis, e.g. the fastest-rising states. Lines
 * take the categorical hues; all text stays in the ink colors (some
 * categorical hues are too light to read as text), and each line is
 * labeled at its end as well as in the legend.
 */
export default function MultiLineChart({ chart }: { chart: MultiLineChartData }) {
  const width = 880;
  const height = 300;
  const padding = { top: 16, right: 92, bottom: 28, left: 52 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const dates = chart.lines[0]?.points.map((p) => p.date) ?? [];
  const values = chart.lines.flatMap((l) => l.points.map((p) => p.value));
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const step = niceStep((max - min) / 4);
  const yMin = Math.floor(min / step) * step;
  const yMax = Math.ceil(max / step) * step;
  const yTicks: number[] = [];
  for (let t = yMin; t <= yMax + step / 2; t += step) yTicks.push(t);

  const xFor = (i: number) => padding.left + (dates.length > 1 ? (i / (dates.length - 1)) * plotWidth : plotWidth / 2);
  const yFor = (v: number) => padding.top + plotHeight * (1 - (v - yMin) / (yMax - yMin || 1));
  const labelEvery = dates.length > 8 ? 2 : 1;

  // End labels, pushed apart so lines ending close together stay readable.
  const ends = chart.lines
    .map((l, i) => ({ label: l.label, color: CATEGORICAL[i % CATEGORICAL.length], last: l.points[l.points.length - 1] }))
    .filter((e) => e.last)
    .map((e) => ({ ...e, y: yFor(e.last.value) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 14);

  const unitSuffix = chart.unit.startsWith("%") ? "%" : "";
  const describe = chart.lines
    .map((l) => `${l.label}: ${l.points.map((p) => `${p.date} ${p.value}${unitSuffix} (${p.detail})`).join(", ")}`)
    .join("; ");

  return (
    <div>
      <div className="mono" style={CHART_TITLE_STYLE}>
        {chart.title}
      </div>
      <ul style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", listStyle: "none", padding: 0, margin: "0 0 8px", fontSize: "0.8rem", color: INK_PRIMARY }}>
        {chart.lines.map((l, i) => (
          <li key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={{ width: 14, height: 3, borderRadius: 2, background: CATEGORICAL[i % CATEGORICAL.length] }} />
            {l.label}
          </li>
        ))}
      </ul>
      <div tabIndex={0} style={CHART_SCROLL_WRAPPER_STYLE}>
        <svg width={width} height={height} style={CHART_CENTERED_CHILD_STYLE} role="img" aria-label={`${chart.title}. ${describe}`}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke={GRIDLINE}
                strokeWidth={tick === 0 ? 1.5 : 1}
              />
              <text x={padding.left - 8} y={yFor(tick) + 3} textAnchor="end" fontSize="10" fill={INK_SECONDARY}>
                {`${tick > 0 && unitSuffix ? "+" : ""}${tick.toLocaleString()}${unitSuffix}`}
              </text>
            </g>
          ))}
          {dates.map((d, i) =>
            i % labelEvery === 0 || i === dates.length - 1 ? (
              <text key={d} x={xFor(i)} y={height - padding.bottom + 16} textAnchor="middle" fontSize="10" fill={INK_SECONDARY}>
                {d}
              </text>
            ) : null
          )}
          {chart.lines.map((l, li) => {
            const color = CATEGORICAL[li % CATEGORICAL.length];
            const d = l.points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(p.value).toFixed(1)}`).join(" ");
            return (
              <g key={l.label}>
                <path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                {l.points.map((p, i) => (
                  <circle key={p.date} cx={xFor(i)} cy={yFor(p.value)} r={3} fill={color} stroke="var(--surface)" strokeWidth={1}>
                    <title>{`${l.label} ${p.date}: ${p.value > 0 && unitSuffix ? "+" : ""}${p.value.toLocaleString()}${unitSuffix} (${p.detail})`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
          {ends.map((e) => (
            <g key={e.label}>
              <circle cx={width - padding.right + 10} cy={e.y - 3} r={3.5} fill={e.color} />
              <text x={width - padding.right + 18} y={e.y} fontSize="11" fontWeight={600} fill={INK_PRIMARY}>
                {`${e.label} ${e.last.value > 0 && unitSuffix ? "+" : ""}${Math.round(e.last.value).toLocaleString()}${unitSuffix}`}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

/** A round axis step (1, 2 or 5 times a power of ten) at least `raw`. */
function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const f = raw / power;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * power;
}
