import { Metadata } from "next"
import { Separator } from "@/components/ui/separator"
import { StorageForm } from "@/components/settings/storage-form"
import { StorageFormContainer } from "@/components/settings/storage-form-new"

// Feature-Flag für neue Storage-Form-Architektur
const USE_NEW_STORAGE_FORM = true

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
      
      {USE_NEW_STORAGE_FORM ? (
        <StorageFormContainer />
      ) : (
        <StorageForm />
      )}
    </div>
  )
} 