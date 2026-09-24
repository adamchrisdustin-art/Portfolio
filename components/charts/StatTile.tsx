/**
 * Stat tile - per the dataviz skill: "a single current value" is a stat
 * tile, not a one-bar bar chart. Used for the dashboard's KPI row
 * (real sums: agencies analyzed, states covered, etc.), never for a
 * fabricated or estimated figure.
 */
export default function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
