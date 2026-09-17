"use client";

import { useEffect } from "react";
import type { DataVizEmbed } from "@/lib/dataViz";

const SCRIPT_ID = "tableau-embedding-api";
const SCRIPT_SRC = "https://public.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js";

// Tableau's Embedding API v3 (<tableau-viz>), not a raw iframe. This
// specifically fixes what a plain iframe embed can't: the published
// workbook here is a Fixed Size dashboard (~2126x1422), so an iframe just
// renders it at native pixel size and clips whatever doesn't fit, with no
// scrollbar exposed (confirmed live - see git history for the iframe
// version this replaced). The <tableau-viz> component is Tableau's own
// JS-managed embed, not a cross-origin iframe someone else's CSS
// controls - it actually scales the visualization to fit the box it's
// given. Needs "use client" since it loads a script and uses a custom
// element, both browser-only.
export default function TableauEmbed({ viz }: { viz: DataVizEmbed }) {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.type = "module";
    script.src = SCRIPT_SRC;
    document.head.appendChild(script);
  }, []);

  const src = `https://public.tableau.com/views/${viz.tableauPath}`;

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "1.05rem", margin: "0 0 6px" }}>{viz.title}</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.94rem", margin: "0 0 14px" }}>
        {viz.description}
      </p>
      <div
        style={{
          width: "100%",
          height: "clamp(400px, 75vh, 820px)",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <tableau-viz src={src} toolbar="bottom" hide-tabs="" style={{ width: "100%", height: "100%" }} />
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
