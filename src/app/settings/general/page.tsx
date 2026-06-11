import { Metadata } from "next"
import { Separator } from "@/components/ui/separator"
import { LibraryForm } from "@/components/settings/library-form"

export const metadata: Metadata = {
  title: "Bibliothek - Grundlagen",
  description: "Verwalten Sie die grundlegenden Einstellungen Ihrer Bibliothek.",
}

// meSpace > Grundlagen: Stammdaten der Bibliothek (vorher unter /settings).
export default function GeneralSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Grundlagen</h3>
        <p className="text-sm text-muted-foreground">
          Name, Status und Verwaltung Ihrer Bibliothek.
        </p>
      </div>
      <Separator />
      <LibraryForm />
    </div>
  )
}
