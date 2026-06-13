import { redirect } from "next/navigation"

// Welle 3-IV-UX (User-Entscheid 2026-06-11): Settings folgen jetzt der
// App-Navigation — diese Route ist nach /settings/archive umgezogen.
export default function RedirectPage() {
  redirect("/settings/archive")
}
