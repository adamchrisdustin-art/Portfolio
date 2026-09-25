import { ORCHESTRATOR, SPECIALISTS, type TeamMember } from "@/cms-intelligence/agents/teamRoster";

const initials = (title: string) =>
  title
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

function MemberTile({ member }: { member: TeamMember }) {
  return (
    <div className="card" style={{ padding: 18, display: "flex", gap: 14, alignItems: "flex-start" }}>
      {/* Placeholder avatar - styling is left for the later design pass. */}
      <div
        aria-hidden="true"
        style={{
          flex: "0 0 auto",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "var(--accent-strong)",
          color: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: "0.9rem",
          letterSpacing: "0.02em",
        }}
      >
        {initials(member.title)}
      </div>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: "1rem", lineHeight: 1.3 }}>{member.title}</h3>
        <p className="mono" style={{ margin: "2px 0 8px", fontSize: "0.74rem", color: "var(--text-muted)" }}>
          {member.domain}
          {member.status && ` · ${member.status}`}
        </p>
        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)" }}>{member.role}</p>
      </div>
    </div>
  );
}

export default function TeamSection() {
  return (
    <section className="container" style={{ padding: "32px 24px", borderTop: "1px solid var(--border)" }}>
      <p className="eyebrow" style={{ marginBottom: 6 }}>
        Meet the team
      </p>
      <h2 style={{ fontSize: "1.3rem", margin: "0 0 16px" }}>The agents behind every finding</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <MemberTile member={ORCHESTRATOR} />
        </div>
        {SPECIALISTS.map((m) => (
          <MemberTile key={m.agentId} member={m} />
        ))}
      </div>
    </section>
  );
}
