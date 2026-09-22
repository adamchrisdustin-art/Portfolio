"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DataVizEmbed } from "@/lib/dataViz";

// Renders the iframe at the workbook's native pixel size, then uses CSS
// `zoom` (not transform: scale) to shrink it to fit the card's measured
// width - zoom affects actual layout size, not just paint, so the
// wrapper can shrink-wrap to it with no manual height math or
// absolute-positioning/overflow edge cases.
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

  // `zoom` isn't in React's CSSProperties typings despite being supported
  // at runtime in every current browser - cast rather than fight the type.
  const iframeStyle: CSSProperties = {
    border: 0,
    display: "block",
    ...(scale !== null ? ({ zoom: scale } as CSSProperties) : {}),
  };

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
          maxHeight: "80vh",
          overflowY: "auto",
          overflowX: "hidden",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        {scale !== null && (
          <iframe
            src={src}
            title={viz.title}
            width={viz.nativeWidth}
            height={viz.nativeHeight}
            loading="lazy"
            style={iframeStyle}
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
