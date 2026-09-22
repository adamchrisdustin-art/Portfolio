"use client";

import { useEffect } from "react";
import type { DataVizEmbed } from "@/lib/dataViz";

const SCRIPT_ID = "tableau-embedding-api";
const SCRIPT_SRC = "https://public.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js";

// Tableau's Embedding API v3 (<tableau-viz>) scales the workbook to fill
// whatever box it's given - width and height both, independently. Handing
// it an arbitrary/oversized fixed pixel box (an earlier version of this
// file did that) makes it zoom in past the real content. The fix: give it
// width:100% (always matches the card, i.e. the window) and a height
// computed from the workbook's real aspect ratio via nativeWidth/
// nativeHeight, so nothing gets stretched or cropped - it's simply the
// real dashboard at whatever width the screen has. If that computed
// height is taller than comfortably fits, the outer card scrolls
// vertically instead of the viz shrinking or clipping.
// Needs "use client" since it loads a script and uses a custom element,
// both browser-only.
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
          maxHeight: "80vh",
          borderRadius: 8,
          overflowY: "auto",
          overflowX: "hidden",
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <tableau-viz
          src={src}
          toolbar="bottom"
          hide-tabs=""
          style={{
            width: "100%",
            height: "auto",
            aspectRatio: `${viz.nativeWidth} / ${viz.nativeHeight}`,
            display: "block",
          }}
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
