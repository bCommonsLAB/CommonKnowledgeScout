import { Metadata } from "next"
import { Separator } from "@/components/ui/separator"
import { StorageForm } from "@/components/settings/storage-form"

export const metadata: Metadata = {
  title: "Bibliothek - Storage-Einstellungen",
  description: "Konfigurieren Sie die Storage-Einstellungen Ihrer Bibliothek.",
}

export default function StoragePage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Storage-Einstellungen</h3>
        <p className="text-sm text-muted-foreground">
          Die Storage-Einstellungen der aktuell ausgewählten Bibliothek werden angezeigt. Zum Bearbeiten wechseln Sie bitte zu den Allgemeinen Einstellungen.
        </p>
      </div>
      <Separator />
      
      <StorageForm />
    </div>
  )
} 