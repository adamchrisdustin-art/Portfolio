import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  return (
    <header style={{ background: "var(--nav)", color: "var(--nav-text)" }}>
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        <Link
          href="/"
          style={{ fontWeight: 700, fontSize: "1.05rem", textDecoration: "none" }}
        >
          Adam Dustin
        </Link>
        <nav aria-label="Primary">
          <ul
            style={{
              display: "flex",
              gap: 28,
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  style={{
                    color: "var(--nav-text-muted)",
                    textDecoration: "none",
                    fontWeight: 500,
                    fontSize: "0.95rem",
                  }}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
