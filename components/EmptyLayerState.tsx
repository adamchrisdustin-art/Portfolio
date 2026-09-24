/**
 * Honest empty state (Phase 5's required "empty" state) - most of the 7
 * dashboard layers have no wired data source yet (see
 * docs/cms-intelligence/MANIFEST.md for what's real vs. planned). This
 * component says so plainly rather than hiding the layer or showing
 * placeholder numbers.
 */
export default function EmptyLayerState({ reason }: { reason: string }) {
  return (
    <div
      className="card"
      style={{
        padding: 22,
        borderStyle: "dashed",
        color: "var(--text-muted)",
        fontSize: "0.92rem",
      }}
    >
      No insights here yet. {reason}
    </div>
  );
}
