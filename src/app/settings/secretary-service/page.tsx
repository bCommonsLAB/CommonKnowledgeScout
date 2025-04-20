import { Metadata } from "next"
import { Separator } from "@/components/ui/separator"
import { SecretaryServiceForm } from "@/components/settings/secretary-service-form"

export const metadata: Metadata = {
  title: "Bibliothek - Secretary Service Einstellungen",
  description: "Konfigurieren Sie die Secretary Service Einstellungen Ihrer Bibliothek.",
}

export default function SecretaryServicePage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Secretary Service Einstellungen</h3>
        <p className="text-sm text-muted-foreground">
          Konfigurieren Sie die Verbindung zum Common Secretary Service. Hier können Sie die API-URL und den API-Key für die Transkriptionsdienste einstellen.
        </p>
      </div>
      <Separator />
      
      <SecretaryServiceForm />
    </div>
  )
} 