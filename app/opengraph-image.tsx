import { ImageResponse } from "next/og";
import { ALL_AGENTS } from "@/cms-intelligence/agents/registry";

export const alt = "Adam Dustin — RevOps, Deal Desk & Agentic Data Systems";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Statically generated at build time (no `runtime = "edge"` - see git
 * history for why), so this regenerates on every real deploy rather than
 * once and forever. The agent count below reads `ALL_AGENTS.length`
 * directly instead of a hardcoded number for exactly that reason - a
 * hardcoded "12-agent" string would silently go stale the next time an
 * agent is added or removed, the same real staleness bug fixed elsewhere
 * on this site's own case-study copy (see MANIFEST.md's History).
 *
 * Caveat this doesn't solve: LinkedIn (and most platforms) cache a
 * link's Open Graph preview the first time it's added somewhere (e.g. a
 * profile's Featured section) and don't re-crawl it automatically on a
 * schedule just because the source page changed. To pull a fresh image
 * into an *existing* Featured link, re-run it through LinkedIn's own
 * Post Inspector (linkedin.com/post-inspector) to force a re-scrape.
 */
export default function OpengraphImage() {
  const agentCount = ALL_AGENTS.length;

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
          + agentic data pipelines and a {agentCount}-agent healthcare intelligence dashboard
        </div>
      </div>
    ),
    { ...size }
  );
}
