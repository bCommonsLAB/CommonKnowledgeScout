import { Metadata } from "next"
import { StartClient } from "./start-client"

export const metadata: Metadata = {
  title: "Start - Knowledge Scout",
  description: "Ihre Bibliotheken auf einen Blick.",
}

// Angemeldetes Dashboard ("keine Library gewählt"-Zustand). Geschützt über die
// Clerk-Middleware (nicht in isPublicRoute → nur eingeloggt erreichbar).
export default function StartPage() {
  return (
    <main className="min-h-screen">
      <StartClient />
    </main>
  )
}
