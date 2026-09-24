import type { CSSProperties } from "react";
import type { AnalyticsOverview } from "@/cms-intelligence/analytics/overview";
import BarChart from "./charts/BarChart";
import BoxPlot from "./charts/BoxPlot";
import DonutChart from "./charts/DonutChart";
import LineChart from "./charts/LineChart";
import StatTile from "./charts/StatTile";

/**
 * "Data Explorer" - a standalone BI-style analytics section, distinct
 * from the per-agent evidence cards elsewhere on this page. Added per
 * Adam's explicit request: he liked the charts tied to specific agent
 * claims, but separately wanted a broader, Tableau-style overview of
 * the underlying data itself, not filtered down to what an agent judged
 * insight-worthy. Every number here comes from
 * cms-intelligence/analytics/overview.ts, computed from the same three
 * real datasets the agents use - nothing here is a distinct or
 * lower-bar data source.
 */
export default function AnalyticsExplorer({ overview }: { overview: AnalyticsOverview }) {
  const panelStyle: CSSProperties = { padding: 20 };

  return (
    <section style={{ borderTop: "1px solid var(--border)" }}>
      <div style={{ background: "var(--nav)", color: "var(--nav-text)", padding: "36px 24px" }}>
        <div className="container">
          <p className="eyebrow" style={{ color: "var(--nav-text-muted)" }}>
            Data Explorer
          </p>
          <h2 style={{ fontSize: "1.6rem", margin: "8px 0 8px", color: "var(--nav-text)" }}>
            The underlying data, unfiltered
          </h2>
          <p style={{ margin: 0, maxWidth: 640, color: "var(--nav-text-muted)", fontSize: "0.92rem" }}>
            Everything above is what the agents judged worth an executive&apos;s attention. This section is the
            broader picture behind it — every real number from the same three CMS datasets, not just the ones that
            became a finding.
          </p>
        </div>
      </div>

      <div className="container" style={{ padding: "28px 24px 48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
          {overview.kpis.map((kpi) => (
            <StatTile key={kpi.label} label={kpi.label} value={kpi.value} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 18 }}>
          {overview.facilityTypeDonut && (
            <div className="card" style={panelStyle}>
              <DonutChart chart={overview.facilityTypeDonut} />
            </div>
          )}
          {overview.ownershipDonut && (
            <div className="card" style={panelStyle}>
              <DonutChart chart={overview.ownershipDonut} />
            </div>
          )}
          {overview.hospitalRatingBar && (
            <div className="card" style={panelStyle}>
              <BarChart chart={overview.hospitalRatingBar} />
            </div>
          )}
          {overview.homeHealthRatingBar && (
            <div className="card" style={panelStyle}>
              <BarChart chart={overview.homeHealthRatingBar} />
            </div>
          )}
          {overview.serviceMixBar && (
            <div className="card" style={panelStyle}>
              <BarChart chart={overview.serviceMixBar} />
            </div>
          )}
          {overview.paymentByProviderTypeBar && (
            <div className="card" style={panelStyle}>
              <BarChart chart={overview.paymentByProviderTypeBar} />
            </div>
          )}
          {overview.spendingRatioBoxplot && (
            <div className="card" style={panelStyle}>
              <BoxPlot chart={overview.spendingRatioBoxplot} />
            </div>
          )}
          {overview.federalRegisterDocumentTypeDonut && (
            <div className="card" style={panelStyle}>
              <DonutChart chart={overview.federalRegisterDocumentTypeDonut} />
            </div>
          )}
          {overview.federalRegisterRulesByMonthBar && (
            <div className="card" style={panelStyle}>
              <BarChart chart={overview.federalRegisterRulesByMonthBar} />
            </div>
          )}
          {overview.maPartDOrgTypeDonut && (
            <div className="card" style={panelStyle}>
              <DonutChart chart={overview.maPartDOrgTypeDonut} />
            </div>
          )}
          {overview.maPartDPlanTypeBar && (
            <div className="card" style={panelStyle}>
              <BarChart chart={overview.maPartDPlanTypeBar} />
            </div>
          )}
          {overview.marketplacePremiumBoxplot && (
            <div className="card" style={panelStyle}>
              <BoxPlot chart={overview.marketplacePremiumBoxplot} />
            </div>
          )}
          {overview.marketplacePlanAvailabilityBar && (
            <div className="card" style={panelStyle}>
              <BarChart chart={overview.marketplacePlanAvailabilityBar} />
            </div>
          )}
          {overview.facilityCountSeries && (
            <div className="card" style={panelStyle}>
              <LineChart series={overview.facilityCountSeries} />
            </div>
          )}
          {overview.ownershipConcentrationSeries && (
            <div className="card" style={panelStyle}>
              <LineChart series={overview.ownershipConcentrationSeries} />
            </div>
          )}
        </div>

        <p style={{ marginTop: 20, fontSize: "0.82rem", color: "var(--text-muted)" }}>
          The two line charts above will get more informative as real history accumulates — this project pulls new
          data on a quarterly cadence (see the case study below), so each real pull adds a point rather than
          replacing the picture. Not shown: a geographic map (this project doesn&apos;t have verified U.S. state
          boundary data to plot against, and won&apos;t guess at one) and a patient-flow diagram (no public CMS
          source here provides patient-level clinical flow data).
        </p>
      </div>
    </section>
  );
}
