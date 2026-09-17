import type { DataVizEmbed } from "@/lib/dataViz";

// Plain iframe embed - Tableau Public's own documented embed pattern for
// this URL shape, same "iframe, no extra script/build step" approach
// CLAUDE.md already specifies for the Streamlit dashboards. No client-side
// JS needed, so this stays a server component.
export default function TableauEmbed({ viz }: { viz: DataVizEmbed }) {
  const src = `https://public.tableau.com/views/${viz.tableauPath}?:showVizHome=no&:embed=y&:toolbar=yes&:tabs=no`;

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "1.05rem", margin: "0 0 6px" }}>{viz.title}</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.94rem", margin: "0 0 14px" }}>
        {viz.description}
      </p>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 3",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <iframe
          src={src}
          title={viz.title}
          loading="lazy"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          allowFullScreen
        />
      </div>
      <p style={{ marginTop: 10 }}>
        <a
          href={viz.profileUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--accent-strong)", fontWeight: 600, fontSize: "0.88rem" }}
        >
          Open full interactive version on Tableau Public →
        </a>
      </p>
    </div>
  );
}
