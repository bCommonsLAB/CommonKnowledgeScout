import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from '@ks/ui'
import { LibraryVerificationPanel } from "@/components/settings/library-verification-panel"
import { ShadowTwinReconcilePanel } from "@/components/settings/shadow-twin-reconcile-panel"
import { MaintenanceTools } from "@/components/settings/library"

export const metadata: Metadata = {
  title: "Bibliothek - Erweitert · Wartung",
  description: "Prüfen, reparieren, bereinigen, Konfiguration übertragen.",
}

// Erweitert · Wartung (Plan speicher-verbindungen-und-library-anlage, Teil B):
// Werkzeuge ohne Config-Formular — Pruefen & Reparieren, Sprachbereinigung,
// Export / Import.
export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Wartung</h3>
        <p className="text-sm text-muted-foreground">
          Zwei getrennte Prüfungen: erst die <strong>Dokument-Angaben</strong>{' '}
          (fehlende Pflichtfelder u.&nbsp;ä.), dann der <strong>Speicher-Abgleich</strong>{' '}
          (stimmen Datenbank und Dateien überein). Darunter Sprachbereinigung und
          Export / Import der Konfiguration.
        </p>
      </div>
      <Separator />

      <section className="space-y-1">
        <h5 className="text-sm font-semibold">Dokument-Angaben prüfen</h5>
        <LibraryVerificationPanel />
      </section>
      <section className="space-y-1">
        <h5 className="text-sm font-semibold pt-2">Mit Speicher abgleichen</h5>
        <ShadowTwinReconcilePanel />
      </section>

      <Separator />

      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <MaintenanceTools />
      </Suspense>
    </div>
  )
}
