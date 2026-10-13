import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from '@ks/ui'
import { AgentViewForm } from "@/components/settings/library"

export const metadata: Metadata = {
  title: "Bibliothek - Erweitert · Agentensicht",
  description: "Konfiguration der Agentensicht (Werkbank) der Bibliothek.",
}

// Erweitert · Agentensicht (Plan speicher-verbindungen-und-library-anlage, Teil B)
export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Agentensicht</h3>
        <p className="text-sm text-muted-foreground">Archiv-Konventionen der Werkbank: Vorhaben, Index-Pflicht, Bericht als Zustand, Themen.</p>
      </div>
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <AgentViewForm />
      </Suspense>
    </div>
  )
}
