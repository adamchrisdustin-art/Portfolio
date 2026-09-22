"use client";

import { useEffect, useRef, useState } from "react";
import type { DataVizEmbed } from "@/lib/dataViz";

// Plain iframe again, not <tableau-viz> - three different attempts to get
// that custom element to size correctly (fit-to-box, an oversized fixed
// box, a CSS aspect-ratio) all produced wrong/zoomed results, and its
// internal sizing logic isn't documented enough to debug blind without a
// real browser to inspect. This uses a much simpler, well-understood
// technique instead: render the iframe at the workbook's TRUE native
// pixel size (confirmed from Tableau's own Size panel, not guessed), then
// scale the whole thing down with a measured `transform: scale()` so its
// rendered width always exactly matches the container - never a sliver
// wider, never clipped, never distorted. Height follows the same uniform
// scale factor, so nothing stretches out of proportion; if it's still
// taller than comfortably fits, the outer wrapper scrolls vertically
// (never horizontally - width is intentionally locked to the container).
export default function TableauEmbed({ viz }: { viz: DataVizEmbed }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      if (width > 0) setScale(width / viz.nativeWidth);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viz.nativeWidth]);

  const src = `https://public.tableau.com/views/${viz.tableauPath}?:showVizHome=no&:embed=y&:toolbar=yes&:tabs=no`;
  const scaledHeight = scale ? viz.nativeHeight * scale : undefined;

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "1.05rem", margin: "0 0 6px" }}>{viz.title}</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.94rem", margin: "0 0 14px" }}>
        {viz.description}
      </p>
      <div
        ref={wrapperRef}
        style={{
          width: "100%",
          // Before the first measurement, avoid a flash of the full
          // native height - once scale is known this becomes the exact
          // scaled-down height so there's no leftover blank space.
          height: scaledHeight ?? 0,
          maxHeight: "80vh",
          position: "relative",
          overflowY: "auto",
          overflowX: "hidden",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          transition: "height 0.15s ease",
        }}
      >
        {scale !== null && (
          <iframe
            src={src}
            title={viz.title}
            width={viz.nativeWidth}
            height={viz.nativeHeight}
            loading="lazy"
            style={{
              border: 0,
              position: "absolute",
              top: 0,
              left: 0,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        )}
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
