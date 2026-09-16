import type { Project } from "@/lib/projects";

const statusLabel: Record<Project["status"], string> = {
  live: "Live",
  "in-progress": "In progress",
  planned: "Planned",
};

const statusColor: Record<Project["status"], string> = {
  live: "#1a7f4b",
  "in-progress": "#b5730a",
  planned: "#51606f",
};

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
        <h3 style={{ fontSize: "1.1rem", margin: 0 }}>{project.title}</h3>
        <span
          className="mono"
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: statusColor[project.status],
            border: `1px solid ${statusColor[project.status]}`,
            borderRadius: 999,
            padding: "2px 9px",
            whiteSpace: "nowrap",
          }}
        >
          {statusLabel[project.status]}
        </span>
      </div>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.94rem" }}>
        {project.summary}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
        {project.stack.map((s) => (
          <span
            key={s}
            className="mono"
            style={{
              fontSize: "0.75rem",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "3px 8px",
              color: "var(--text-muted)",
            }}
          >
            {s}
          </span>
        ))}
      </div>
      {project.links && project.links.length > 0 && (
        <div style={{ display: "flex", gap: 14 }}>
          {project.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent-strong)", fontWeight: 600, fontSize: "0.88rem" }}
            >
              {l.label} →
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
