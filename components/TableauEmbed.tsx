"use client";

import { useEffect } from "react";
import type { DataVizEmbed } from "@/lib/dataViz";

const SCRIPT_ID = "tableau-embedding-api";
const SCRIPT_SRC = "https://public.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js";

// Generous default render size - larger than the workbook actually needs,
// on purpose. See DataVizEmbed.renderWidth/renderHeight in lib/dataViz.ts
// for the reasoning: giving <tableau-viz> a box this big means nothing
// inside it is ever forced to scale down (that's what "Automatic" sizing
// in Tableau itself was doing, and no CSS here can undo that - it has to
// stay Fixed Size in Tableau for this to work). The visible card is
// smaller than this and scrolls instead of clipping or shrinking.
const DEFAULT_RENDER_WIDTH = 1800;
const DEFAULT_RENDER_HEIGHT = 1100;

// Tableau's Embedding API v3 (<tableau-viz>), not a raw iframe - lets us
// give the viz an explicit native pixel size instead of a percentage, so
// it never tries to fit-to-box on its own. Needs "use client" since it
// loads a script and uses a custom element, both browser-only.
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
  const renderWidth = viz.renderWidth ?? DEFAULT_RENDER_WIDTH;
  const renderHeight = viz.renderHeight ?? DEFAULT_RENDER_HEIGHT;

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "1.05rem", margin: "0 0 6px" }}>{viz.title}</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.94rem", margin: "0 0 14px" }}>
        {viz.description}
      </p>
      {/*
        Visible window onto the viz: fixed comfortable height, scrolls in
        both directions instead of clipping or shrinking whatever doesn't
        fit. The tableau-viz element inside is rendered at its full native
        size (renderWidth x renderHeight), not squeezed to 100%/100%.
      */}
      <div
        style={{
          width: "100%",
          height: "clamp(400px, 75vh, 820px)",
          borderRadius: 8,
          overflow: "auto",
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <tableau-viz
          src={src}
          toolbar="bottom"
          hide-tabs=""
          style={{ width: `${renderWidth}px`, height: `${renderHeight}px`, display: "block" }}
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
