export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        marginTop: 64,
        padding: "28px 0",
        color: "var(--text-muted)",
        fontSize: "0.85rem",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span>&copy; {new Date().getFullYear()} Adam Dustin. Spokane, WA.</span>
        <span>
          <a href="mailto:adam.chris.dustin@gmail.com">adam.chris.dustin@gmail.com</a>
          {" · "}
          <a
            href="https://linkedin.com/in/adustin42"
            target="_blank"
            rel="noreferrer"
          >
            linkedin.com/in/adustin42
          </a>
        </span>
      </div>
    </footer>
  );
}
