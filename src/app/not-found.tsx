import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      background: "#f8fafc",
      color: "#1e293b",
      textAlign: "center"
    }}>
      <h1 style={{ fontSize: "2.5rem", fontWeight: "bold" }}>404 - Seite nicht gefunden</h1>
      <p style={{ margin: "1rem 0" }}>Die angeforderte Seite konnte nicht gefunden werden.</p>
      <Link href="/" style={{ color: "#3b82f6", textDecoration: "underline", fontWeight: 500 }}>
        Zurück zur Startseite
      </Link>
    </div>
  );
} 