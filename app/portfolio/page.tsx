import type { Metadata } from "next";
import { projects } from "@/lib/projects";
import ProjectCard from "@/components/ProjectCard";

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
    </section>
  );
}
