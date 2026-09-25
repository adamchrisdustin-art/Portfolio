import type { ChartList } from "@/cms-intelligence/intelligence/evidence/schema";
import { CHART_TITLE_STYLE, INK_PRIMARY, INK_SECONDARY, MAGNITUDE_HUE } from "./chartTheme";

/**
 * A linked bullet list of real named items (see ChartList in schema.ts) -
 * for insights whose real payload is "here are the actual named things,"
 * not a magnitude to compare. Each item links to its own real source URL
 * when one exists; never a fabricated link. No horizontal scroll needed
 * (text wraps), unlike the SVG chart components.
 */
export default function ListChart({ chart }: { chart: ChartList }) {
  return (
    <div className="chart">
      <div className="mono" style={CHART_TITLE_STYLE}>
        {chart.title}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {chart.items.map((item, i) => (
          <li key={i} style={{ borderLeft: `2px solid ${MAGNITUDE_HUE}`, paddingLeft: 10 }}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: INK_PRIMARY, fontSize: "0.85rem" }}>
                {item.label}
              </a>
            ) : (
              <span style={{ color: INK_PRIMARY, fontSize: "0.85rem" }}>{item.label}</span>
            )}
            {item.detail && (
              <div className="mono" style={{ color: INK_SECONDARY, fontSize: "0.72rem", marginTop: 2 }}>
                {item.detail}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
