import { formatPeriod, shortHeadline, stakeholdersFor } from "@/cms-intelligence/analytics/findingPresentation";
import { SOURCE_LABELS } from "@/cms-intelligence/data/sources/sourceLabels";
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

const RECENCY_CHIP: Record<"current" | "aging" | "stale", { label: string; title: string }> = {
  current: { label: "current", title: "On schedule: this is the newest data its publisher normally has out by now." },
  aging: { label: "aging", title: "This source is 1-2 years past its next expected update; kept, but ranked below current findings." },
  stale: { label: "stale", title: "No update in over two years past when one was due; kept for reference, not treated as a current signal." },
};

const chipStyle = {
  fontSize: "0.72rem",
  color: "var(--text-muted)",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 999,
  padding: "2px 9px",
} as const;

/**
 * Confidence is shown only inside the evidence drawer: nearly every finding
 * reads "low" until sources build enough history for a change to persist,
 * so a badge on every card is noise for now. Resurface it on the card once
 * findings differ (Adam, 2026-09-25).
 *
 * Renders one Insight per docs/cms-intelligence/EVIDENCE_MODEL.md's
 * schema, with an inline evidence drawer (native <details> - no client
 * JS needed, works the same in a static export). This is the one shared
 * card component every dashboard layer uses - see DASHBOARD_BLUEPRINT.md's
 * "shared components across all seven layers" section.
 */
export default function InsightCard({ insight, collapsible = false, related = [] }: { insight: Insight; collapsible?: boolean; related?: Insight[] }) {
  const headline = <h3 style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.4, display: "inline" }}>{insight.headline}</h3>;
  const recency = insight.freshness.recency ?? (insight.freshness.isStale ? "stale" : "current");
  const stakeholders = stakeholdersFor(insight);
  const body = (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span className="mono" style={chipStyle}>
          {populationLabel[insight.population]}
        </span>
        <span className="mono" style={chipStyle}>
          {insight.signalType}
        </span>
        <span
          className="mono"
          title={RECENCY_CHIP[recency].title}
          style={
            recency === "stale"
              ? { ...chipStyle, background: "transparent", fontWeight: 700, color: "#8a3a3a", borderColor: "#8a3a3a" }
              : recency === "aging"
                ? { ...chipStyle, background: "transparent", borderStyle: "dashed" }
                : chipStyle
          }
        >
          {RECENCY_CHIP[recency].label}
        </span>
      </div>

      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.92rem" }}>{insight.businessRelevance}</p>

      <div className="mono" style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 2 }}>
        <span>
          {insight.geography.label} · period covered: {formatPeriod(insight.period)}
        </span>
        {stakeholders.length > 0 && <span>Affects: {stakeholders.join(" · ")}</span>}
      </div>

      {insight.chart && <ChartRenderer chart={insight.chart} />}
      {insight.series && <Sparkline series={insight.series} />}

      {related.length > 0 && (
        <div style={{ fontSize: "0.86rem" }}>
          <strong>Read alongside:</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 20, color: "var(--text-muted)" }}>
            {related.map((r) => (
              <li key={r.id}>
                <a href={`#${r.id}`}>{shortHeadline(r.headline)}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                  {e.description} — source:{" "}
                  {SOURCE_LABELS[e.sourceId] ? (
                    <a href={SOURCE_LABELS[e.sourceId].url} target="_blank" rel="noopener noreferrer">
                      {SOURCE_LABELS[e.sourceId].name}
                    </a>
                  ) : (
                    <span className="mono">{e.sourceId}</span>
                  )}
                  {e.url && e.url !== SOURCE_LABELS[e.sourceId]?.url && (
                    <>
                      {" "}
                      (
                      <a href={e.url} target="_blank" rel="noopener noreferrer">
                        this record
                      </a>
                      )
                    </>
                  )}
                  , vintage {e.datasetVintage}
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
