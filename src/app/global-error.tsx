'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          background: "#f8fafc",
          color: "#1e293b",
          textAlign: "center",
          padding: "2rem"
        }}>
          <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
            Ein Fehler ist aufgetreten
          </h1>
          <p style={{ margin: "1rem 0", color: "#64748b" }}>
            {error.message || "Ein unerwarteter Fehler ist aufgetreten."}
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontWeight: 500
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  )
} 