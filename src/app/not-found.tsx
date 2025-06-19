'use client'

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
      textAlign: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
        404 - Seite nicht gefunden
      </h1>
      <p style={{ margin: "1rem 0", color: "#64748b" }}>
        Die angeforderte Seite konnte nicht gefunden werden.
      </p>
      <Link 
        href="/" 
        style={{ 
          color: "#3b82f6", 
          textDecoration: "underline", 
          fontWeight: 500,
          marginTop: "1rem"
        }}
      >
        Zurück zur Startseite
      </Link>
    </div>
  );
} 