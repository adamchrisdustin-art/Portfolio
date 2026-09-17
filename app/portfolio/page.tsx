import type { Metadata } from "next";
import { projects } from "@/lib/projects";
import { dataVizEmbeds } from "@/lib/dataViz";
import ProjectCard from "@/components/ProjectCard";
import TableauEmbed from "@/components/TableauEmbed";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Data and agentic AI projects by Adam Dustin.",
};

export default function PortfolioPage() {
  return (
    <section className="container" style={{ padding: "56px 24px 72px" }}>
      <p className="eyebrow">Portfolio</p>
      <h1 style={{ fontSize: "2rem", margin: "10px 0 12px" }}>Projects</h1>
      <p style={{ maxWidth: 640, color: "var(--text-muted)", marginBottom: 36 }}>
        This grows as new projects ship — status is marked honestly rather
        than implying everything below is finished and live today.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
        }}
      >
        {projects.map((p) => (
          <ProjectCard key={p.slug} project={p} />
        ))}
      </div>

      {dataVizEmbeds.length > 0 && (
        <div style={{ marginTop: 56 }}>
          <h2 style={{ fontSize: "1.4rem", margin: "0 0 8px" }}>
            Data Visualization &amp; Complex Analysis
          </h2>
          <p style={{ maxWidth: 640, color: "var(--text-muted)", marginBottom: 24 }}>
            Live, interactive Tableau workbooks — not screenshots. Full profile:{" "}
            <a
              href="https://public.tableau.com/app/profile/adam1482/vizzes"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent-strong)", fontWeight: 600 }}
            >
              public.tableau.com/app/profile/adam1482
            </a>
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: 20,
            }}
          >
            {dataVizEmbeds.map((viz) => (
              <TableauEmbed key={viz.slug} viz={viz} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
