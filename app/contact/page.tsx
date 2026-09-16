import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Adam Dustin.",
};

export default function ContactPage() {
  return (
    <section className="container" style={{ padding: "56px 24px 96px" }}>
      <p className="eyebrow">Contact</p>
      <h1 style={{ fontSize: "2rem", margin: "10px 0 24px" }}>Get in touch</h1>
      <div className="card" style={{ padding: 28, maxWidth: 480 }}>
        <dl style={{ margin: 0 }}>
          <dt style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Email
          </dt>
          <dd style={{ margin: "4px 0 18px" }}>
            <a href="mailto:adam.chris.dustin@gmail.com" style={{ fontWeight: 600 }}>
              adam.chris.dustin@gmail.com
            </a>
          </dd>
          <dt style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            LinkedIn
          </dt>
          <dd style={{ margin: "4px 0 18px" }}>
            <a
              href="https://linkedin.com/in/adustin42"
              target="_blank"
              rel="noreferrer"
              style={{ fontWeight: 600 }}
            >
              linkedin.com/in/adustin42
            </a>
          </dd>
          <dt style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Location
          </dt>
          <dd style={{ margin: "4px 0 18px" }}>Spokane, WA</dd>
          <dt style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Resume
          </dt>
          <dd style={{ margin: "4px 0 0" }}>
            <a href="/resume.pdf" style={{ fontWeight: 600 }}>
              Download PDF →
            </a>
          </dd>
        </dl>
      </div>
      {/*
        Contact form: ROADMAP.md specifies Formspree free tier (50
        submissions/month, no server code) if a form is added later.
        Direct links only for now - simplest thing that works, and this
        volume of traffic doesn't need a form yet.
      */}
    </section>
  );
}
