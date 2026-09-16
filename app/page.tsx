import Link from "next/link";
import { experience } from "@/lib/experience";
import { skillGroups } from "@/lib/skills";

const pillars = [
  {
    title: "Deal Desk & Revenue Operations",
    body: "Owned Deal Desk on $10M+ negotiations, sales compensation design, and GTM rollout for a company that grew ARR by $100M+ — including navigating four acquisitions from both sides of the table.",
  },
  {
    title: "Salesforce & Systems Administration",
    body: "Admin-level Salesforce ownership across territory design, approval routing, and post-merger instance consolidation, plus a sandboxed Salesforce Developer org used for hands-on agentic-workflow experiments.",
  },
  {
    title: "BI & Analytics",
    body: "Customer Success and revenue dashboards in Streamlit, Power BI, and Tableau — client risk, NPS, renewals, and NRR — grounded in real statistical modeling (Holt-Winters, random forest) rather than dashboard assembly alone.",
  },
  {
    title: "Data Pipelines & Emerging AI",
    body: "Building agentic pipelines that watch public datasets, detect meaningful change, and turn it into a written brief — the CMS market-analysis project on the Portfolio page is a live example, not a slide.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="container" style={{ padding: "72px 24px 48px" }}>
        <p className="eyebrow">Revenue Operations · Deal Desk · Agentic Data Systems</p>
        <h1
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: 1.15,
            maxWidth: 820,
            margin: "12px 0 20px",
          }}
        >
          I run the revenue engine — pricing, pipeline, and the CRM behind it —
          and I build the AI agents that keep it honest.
        </h1>
        <p
          style={{
            maxWidth: 640,
            fontSize: "1.05rem",
            color: "var(--text-muted)",
            marginBottom: 28,
          }}
        >
          Seven years in RevOps and Deal Desk, most recently owning eight-figure
          deal negotiations and Salesforce administration through four
          acquisitions. Now applying that same operational discipline to
          agentic workflows: pipelines that pull real data, watch it change,
          and report on it without a human re-running the query every time.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/portfolio" className="btn btn-primary">
            See the projects
          </Link>
          <a href="/resume.pdf" className="btn btn-secondary">
            Download resume
          </a>
          <Link href="/contact" className="btn btn-secondary">
            Get in touch
          </Link>
        </div>
      </section>

      <section
        className="container"
        style={{ padding: "40px 24px", borderTop: "1px solid var(--border)" }}
      >
        <h2 style={{ fontSize: "1.4rem", marginBottom: 24 }}>Where I operate</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}
        >
          {pillars.map((p) => (
            <div key={p.title} className="card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: "1.05rem", marginBottom: 10 }}>{p.title}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: 0 }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="container"
        style={{ padding: "40px 24px", borderTop: "1px solid var(--border)" }}
      >
        <h2 style={{ fontSize: "1.4rem", marginBottom: 24 }}>Experience</h2>
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {experience.map((e) => (
            <li
              key={e.role + e.org}
              style={{
                display: "grid",
                gridTemplateColumns: "220px 1fr",
                gap: 20,
                padding: "16px 0",
                borderBottom: "1px solid var(--border)",
                alignItems: "start",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{e.role}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  {e.org}
                </div>
                <div className="mono" style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                  {e.dates}
                </div>
              </div>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>{e.line}</p>
            </li>
          ))}
        </ol>
        <p style={{ marginTop: 16 }}>
          <a href="/resume.pdf" style={{ color: "var(--accent-strong)", fontWeight: 600 }}>
            Full resume (PDF) →
          </a>
        </p>
      </section>

      <section
        className="container"
        style={{ padding: "40px 24px 72px", borderTop: "1px solid var(--border)" }}
      >
        <h2 style={{ fontSize: "1.4rem", marginBottom: 24 }}>Skills</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 24,
          }}
        >
          {skillGroups.map((g) => (
            <div key={g.label}>
              <p className="eyebrow" style={{ marginBottom: 10 }}>
                {g.label}
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {g.items.map((item) => (
                  <li
                    key={item}
                    style={{
                      fontSize: "0.92rem",
                      color: "var(--text)",
                      padding: "5px 0",
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
