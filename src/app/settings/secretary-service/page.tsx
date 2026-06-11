import { Metadata } from "next"
import { Separator } from "@/components/ui/separator"
import { SecretaryServiceForm } from "@/components/settings/secretary-service-form"

export const metadata: Metadata = {
  title: "Bibliothek - Verarbeitung",
  description: "Wie Ihre Dokumente zu Wissen verarbeitet werden.",
}

// meSpace > Verarbeitung. Technische Teile (PDF-Extraktion, LLM,
// Service-Verbindung, Teams-Relay) liegen unter /settings/advanced.
export default function SecretaryServicePage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Verarbeitung</h3>
        <p className="text-sm text-muted-foreground">
          Wie Ihre Dokumente zu Wissen verarbeitet werden: Template,
          Zielsprache und Cover-Bild für neue Verarbeitungsläufe.
        </p>
      </div>
      <Separator />

      <SecretaryServiceForm />
    </div>
  )
}
