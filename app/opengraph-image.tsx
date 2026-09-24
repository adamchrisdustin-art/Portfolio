import { ImageResponse } from "next/og";

export const alt = "Adam Dustin — RevOps, Deal Desk & Agentic Data Systems";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0d1117",
          color: "#e7ebf0",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#e2a13d", letterSpacing: 2, textTransform: "uppercase" }}>adamdustin.me</div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 700, marginTop: 24, lineHeight: 1.15 }}>Adam Dustin</div>
        <div style={{ display: "flex", fontSize: 36, color: "#9fb0c2", marginTop: 16, maxWidth: 980 }}>
          Revenue Operations &amp; Deal Desk, anchored in healthcare payer/provider markets
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#e2a13d", marginTop: 48 }}>
          + agentic data pipelines and a 12-agent healthcare intelligence dashboard
        </div>
      </div>
    ),
    { ...size }
  );
}
