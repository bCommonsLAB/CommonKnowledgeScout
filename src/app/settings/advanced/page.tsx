import { redirect } from "next/navigation"

// Alte Route „Erweitert" (eine Seite fuer alles) → erste Unterseite
// (Plan speicher-verbindungen-und-library-anlage, Teil B).
export default function AdvancedSettingsPage() {
  redirect("/settings/advanced/suche-ki")
}
