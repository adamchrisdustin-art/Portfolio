import type { Insight } from "@/cms-intelligence/intelligence/evidence/schema";
import ChartRenderer from "./charts/ChartRenderer";
import Sparkline from "./Sparkline";

const populationLabel: Record<Insight["population"], string> = {
  "medicare-ffs": "Medicare FFS",
  "medicare-advantage": "Medicare Advantage",
  "part-d": "Part D",
  medicaid: "Medicaid",
  chip: "CHIP",
  "dual-eligible": "Dual Eligible",
  marketplace: "ACA Marketplace",
  "cross-population": "Cross-population",
  "n/a": "N/A",
};

/**
 * Confidence is shown only inside the evidence drawer: with about a week of
 * snapshot history, nearly every finding reads "low", so a badge on every
 * card was noise rather than signal (Adam, 2026-09-25).
 *
 * Renders one Insight per docs/cms-intelligence/EVIDENCE_MODEL.md's
 * schema, with an inline evidence drawer (native <details> - no client
 * JS needed, works the same in a static export). This is the one shared
 * card component every dashboard layer uses - see DASHBOARD_BLUEPRINT.md's
 * "shared components across all seven layers" section.
 */
export default function InsightCard({ insight, collapsible = false }: { insight: Insight; collapsible?: boolean }) {
  const headline = <h3 style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.4, display: "inline" }}>{insight.headline}</h3>;
  const body = (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span
          className="mono"
          style={{
            fontSize: "0.72rem",
            color: "var(--text-muted)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "2px 9px",
          }}
        >
          {populationLabel[insight.population]}
        </span>
        <span
          className="mono"
          style={{
            fontSize: "0.72rem",
            color: "var(--text-muted)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "2px 9px",
          }}
        >
          {insight.signalType}
        </span>
        {insight.freshness.isStale && (
          <span
            className="mono"
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#8a3a3a",
              border: "1px solid #8a3a3a",
              borderRadius: 999,
              padding: "2px 9px",
            }}
          >
            stale
          </span>
        )}
      </div>

      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.92rem" }}>{insight.businessRelevance}</p>

      <div className="mono" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
        {insight.geography.label} · data as of {insight.freshness.dataAsOf}
      </div>

      {insight.chart && <ChartRenderer chart={insight.chart} />}
      {insight.series && <Sparkline series={insight.series} />}

      <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.88rem", color: "var(--accent-strong)" }}>
          Inspect evidence
        </summary>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10, fontSize: "0.86rem", overflowWrap: "anywhere" }}>
          <div>
            <strong>Confidence:</strong>{" "}
            <span className="mono" style={{ fontWeight: 700, textTransform: "uppercase" }}>
              {insight.confidence}
            </span>
          </div>
          <div>
            <strong>Why {insight.confidence} confidence:</strong>{" "}
            <span style={{ color: "var(--text-muted)" }}>{insight.confidenceRationale}</span>
          </div>
          <div>
            <strong>Evidence:</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 20, color: "var(--text-muted)" }}>
              {insight.evidence.map((e) => (
                <li key={e.id}>
                  {e.description} — source <span className="mono">{e.sourceId}</span>, vintage {e.datasetVintage}
                </li>
              ))}
            </ul>
          </div>
          {insight.contradictoryEvidence.length > 0 && (
            <div>
              <strong>Contradictory evidence:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20, color: "var(--text-muted)" }}>
                {insight.contradictoryEvidence.map((e) => (
                  <li key={e.id}>{e.description}</li>
                ))}
              </ul>
            </div>
          )}
          {insight.limitations.length > 0 && (
            <div>
              <strong>Limitations:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20, color: "var(--text-muted)" }}>
                {insight.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <strong>Next signal to watch:</strong> <span style={{ color: "var(--text-muted)" }}>{insight.nextSignal}</span>
          </div>
          <div className="mono" style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
            Generated by {insight.generatingAgent} · {insight.id}
          </div>
        </div>
      </details>
    </>
  );

  const cardStyle = { padding: collapsible ? "14px 18px" : 22, scrollMarginTop: 80 } as const;
  if (collapsible) {
    return (
      <article id={insight.id} className="card" style={cardStyle}>
        <details className="insight-details">
          <summary style={{ cursor: "pointer" }}>{headline}</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>{body}</div>
        </details>
      </article>
    );
  }
  return (
    <article id={insight.id} className="card" style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.4 }}>{insight.headline}</h3>
      {body}
    </article>
  );
}
