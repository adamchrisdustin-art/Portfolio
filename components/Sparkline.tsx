import type { InsightSeries } from "@/cms-intelligence/intelligence/evidence/schema";

/**
 * The dashboard's first real chart - inline SVG, no charting dependency
 * added (consistent with this repo's low-dependency convention). Renders
 * only real snapshot-backed data via InsightSeries - never a fabricated
 * or interpolated point. See docs/cms-intelligence/DASHBOARD_BLUEPRINT.md
 * for the fuller chart plan this is the first step of.
 */
export default function Sparkline({ series }: { series: InsightSeries }) {
  const { points } = series;
  if (points.length < 2) return null;

  const width = 280;
  const height = 56;
  const padding = 6;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // avoid divide-by-zero when every point is identical (a real, honest "flat" series)

  const stepX = (width - padding * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = padding + i * stepX;
    const y = padding + (height - padding * 2) * (1 - (p.value - min) / range);
    return { x, y };
  });
  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <div>
      <div className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4 }}>
        {series.label} ({points.length} real pull{points.length === 1 ? "" : "s"})
      </div>
      <div style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
        <svg width={width} height={height} style={{ flexShrink: 0 }} role="img" aria-label={`${series.label} over time: ${points.map((p) => `${p.date} ${p.value}`).join(", ")}`}>
          <polyline points={`${padding},${height - padding} ${width - padding},${height - padding}`} stroke="var(--border)" strokeWidth={1} fill="none" />
          <path d={pathD} stroke="var(--accent-strong)" strokeWidth={2} fill="none" />
          {coords.map((c, i) => (
            <circle key={points[i].date} cx={c.x} cy={c.y} r={2.5} fill="var(--accent-strong)" />
          ))}
        </svg>
      </div>
      <div className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", maxWidth: width, margin: "0 auto" }}>
        <span>{points[0].date}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}
