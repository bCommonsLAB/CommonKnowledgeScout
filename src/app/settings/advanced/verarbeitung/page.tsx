import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from '@ks/ui'
import { SecretaryAdvancedForm } from "@/components/settings/secretary-advanced-form"
import { TeamsStreamRelayPanel } from "@/components/settings/teams-stream-relay-panel"

export const metadata: Metadata = {
  title: "Bibliothek - Erweitert · Verarbeitung",
  description: "Vorlage, Transkription, Modellwahl und Service-Verbindung der Bibliothek.",
}

// Erweitert · Verarbeitung (Plan speicher-verbindungen-und-library-anlage, Teil B)
export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Verarbeitung</h3>
        <p className="text-sm text-muted-foreground">Vorlage, Transkription und Modellwahl, Service-Verbindung und Teams-Aufzeichnung.</p>
      </div>
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <SecretaryAdvancedForm />
        <TeamsStreamRelayPanel />
      </Suspense>
    </div>
  )
}
