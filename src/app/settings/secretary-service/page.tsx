import { Metadata } from "next"
import { Separator } from "@/components/ui/separator"
import { SecretaryServiceForm } from "@/components/settings/secretary-service-form"
import { TeamsStreamRelayPanel } from "@/components/settings/teams-stream-relay-panel"

export const metadata: Metadata = {
  title: "Bibliothek - Transformation",
  description: "Konfigurieren Sie die Transformations-Einstellungen Ihrer Bibliothek.",
}

export default function SecretaryServicePage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Transformation</h3>
        <p className="text-sm text-muted-foreground">
          Standardwerte für die Transkription und Transformation Ihrer Dokumente. Diese Einstellungen werden bei neuen Verarbeitungsjobs verwendet.
        </p>
      </div>
      <Separator />

      <TeamsStreamRelayPanel />

      <Separator />

      <SecretaryServiceForm />
    </div>
  )
} 