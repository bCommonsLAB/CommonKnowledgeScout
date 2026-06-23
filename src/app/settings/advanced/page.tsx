import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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

      {/* KI & Suche + Binary Storage (Chat-Config) */}
      <section className="space-y-2">
        <h4 className="text-base font-semibold">KI, Suche & Binary Storage</h4>
        <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
          <ChatAdvancedForm />
        </Suspense>
      </section>

      <Separator />

      {/* Verifikation: Status + Prüfen/Reparieren (Welle A1/A2) */}
      <section className="space-y-2">
        <h4 className="text-base font-semibold">Verifikation</h4>
        <LibraryVerificationPanel />
      </section>

      <Separator />

      {/* Speicher synchronisieren: Library-weiter Shadow-Twin-Reconcile (Transkripte + Bilder/B1) */}
      <section className="space-y-2">
        <h4 className="text-base font-semibold">Mit Speicher synchronisieren</h4>
        <ShadowTwinReconcilePanel />
      </section>

      <Separator />

      {/* Cache/Speicherstrategie, Migration, DIVA, Import/Export (Library-Config) */}
      <section className="space-y-2">
        <h4 className="text-base font-semibold">Daten & Wartung</h4>
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
