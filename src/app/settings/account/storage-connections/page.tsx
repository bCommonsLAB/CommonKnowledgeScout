import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from '@ks/ui'
import { StorageConnectionsSection } from "@/components/settings/account/storage-connections/storage-connections-section"

export const metadata: Metadata = {
  title: "Mein Konto - Speicher-Verbindungen",
  description: "Nextcloud- und OneDrive-Zugänge, die zu Ihrem Konto gehören.",
}

// Mein Konto > Speicher-Verbindungen (Plan speicher-verbindungen-und-library-anlage, Teil A, A1)
export default function StorageConnectionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Speicher-Verbindungen</h3>
        <p className="text-sm text-muted-foreground">
          Zugänge zu Ihren Speichern — gelten für Sie als Person, unabhängig von der ausgewählten Bibliothek.
        </p>
      </div>
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <StorageConnectionsSection />
      </Suspense>
    </div>
  )
}
