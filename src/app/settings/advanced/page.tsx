import { Metadata } from "next"
import { Suspense } from "react"
import { Separator, Alert, AlertDescription, AlertTitle } from '@ks/ui'
import { AlertTriangle } from "lucide-react"
import { LibraryAdvancedForm } from "@/components/settings/library"
import { ChatAdvancedForm } from "@/components/settings/chat"
import { SecretaryAdvancedForm } from "@/components/settings/secretary-advanced-form"
import { TeamsStreamRelayPanel } from "@/components/settings/teams-stream-relay-panel"
import { LibraryVerificationPanel } from "@/components/settings/library-verification-panel"
import { ShadowTwinReconcilePanel } from "@/components/settings/shadow-twin-reconcile-panel"

export const metadata: Metadata = {
  title: "Bibliothek - Erweitert",
  description: "Experten-Einstellungen der Bibliothek.",
}

// meSpace > Erweitert (Welle 3-IV-UX-3a, F7/F8): Experten-Werkzeuge,
// klar abgegrenzt, aber sichtbar (E6 — kein versteckter Modus).
export default function AdvancedSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Erweitert</h3>
        <p className="text-sm text-muted-foreground">
          Experten-Einstellungen. Ohne Änderungen gelten überall sinnvolle
          Standardwerte.
        </p>
      </div>
      <Separator />

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Für erfahrene Nutzer</AlertTitle>
        <AlertDescription>
          Änderungen in diesem Bereich können Neu-Indexierung, längere
          Verarbeitungsläufe oder zusätzliche Kosten auslösen.
        </AlertDescription>
      </Alert>

      {/* KI & Suche + Bild-Speicher (Chat-Config) */}
      <section className="space-y-2">
        <h4 className="text-base font-semibold">KI, Suche & Bilder</h4>
        <p className="text-sm text-muted-foreground">
          Wie die Bibliothek sucht und antwortet — und wo Bilder liegen.
        </p>
        <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
          <ChatAdvancedForm />
        </Suspense>
      </section>

      <Separator />

      {/* Pruefen & Reparieren: Metadaten (Verifikation) + Speicher-Abgleich (Reconcile) */}
      <section className="space-y-2">
        <h4 className="text-base font-semibold">Prüfen & Reparieren</h4>
        <p className="text-sm text-muted-foreground">
          Zwei getrennte Prüfungen: erst die <strong>Dokument-Angaben</strong>{' '}
          (fehlende Pflichtfelder u.&nbsp;ä.), dann der <strong>Speicher-Abgleich</strong>{' '}
          (stimmen Datenbank und Dateien überein).
        </p>
        <div className="space-y-1">
          <h5 className="text-sm font-semibold pt-2">Dokument-Angaben prüfen</h5>
          <LibraryVerificationPanel />
        </div>
        <div className="space-y-1">
          <h5 className="text-sm font-semibold pt-4">Mit Speicher abgleichen</h5>
          <ShadowTwinReconcilePanel />
        </div>
      </section>

      <Separator />

      {/* Cache/Speicherstrategie, Migration, DIVA, Import/Export (Library-Config) */}
      <section className="space-y-2">
        <h4 className="text-base font-semibold">Daten & Wartung</h4>
        <p className="text-sm text-muted-foreground">
          Selten gebrauchte Werkzeuge: Backup ins Dateisystem, Wiederherstellung,
          Import/Export.
        </p>
        <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
          <LibraryAdvancedForm />
        </Suspense>
      </section>

      <Separator />

      {/* Service-Verbindung (Secretary-Config) */}
      <section className="space-y-2">
        <h4 className="text-base font-semibold">Verarbeitungs-Service</h4>
        <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
          <SecretaryAdvancedForm />
        </Suspense>
        <TeamsStreamRelayPanel />
      </section>
    </div>
  )
}
