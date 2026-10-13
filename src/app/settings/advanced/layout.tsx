import { Alert, AlertDescription, AlertTitle } from '@ks/ui'
import { AlertTriangle } from "lucide-react"

// meSpace > Erweitert (Welle 3-IV-UX-3a, F7/F8): Experten-Werkzeuge, klar
// abgegrenzt, aber sichtbar (E6 — kein versteckter Modus). Seit Teil B des
// Plans speicher-verbindungen-und-library-anlage je Thema eine Unterseite;
// der Hinweis gilt fuer alle sieben.
export default function AdvancedSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Für erfahrene Nutzer</AlertTitle>
        <AlertDescription>
          Änderungen in diesem Bereich können Neu-Indexierung, längere
          Verarbeitungsläufe oder zusätzliche Kosten auslösen. Ohne Änderungen
          gelten überall sinnvolle Standardwerte.
        </AlertDescription>
      </Alert>
      {children}
    </div>
  )
}
