import { Separator } from "@/components/ui/separator"
import { LibraryForm } from "@/components/settings/library-form"

export default function OwnerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Bibliothek</h3>
        <p className="text-sm text-muted-foreground">
          Verwalten Sie Ihre Bibliotheks Einstellungen. Setzen Sie Ihre bevorzugte Sprache.
        </p>
      </div>
      <Separator />
      <LibraryForm />
    </div>
  )
} 