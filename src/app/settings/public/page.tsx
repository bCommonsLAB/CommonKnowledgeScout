import { Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { PublicForm } from "@/components/settings/public-form"
import { TranslationsForm } from "@/components/settings/translations-form"

export default function PublicPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Library veröffentlichen</h3>
        <p className="text-sm text-muted-foreground">
          Verwalten Sie die Einstellungen für den öffentlichen Zugriff auf Ihre Library. Stellen Sie einen Slug-Namen ein,
          fügen Sie eine Beschreibung hinzu und konfigurieren Sie die öffentliche Verfügbarkeit.
        </p>
      </div>
      <Separator />
      <PublicForm />
      {/* Dokument-Uebersetzungen: gehoeren zum Teilen mit anderen —
          Inhalte fuer ein anderssprachiges Publikum zugaenglich machen
          (User-Entscheid 2026-06-11, vorher meSpace > Archiv). */}
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <TranslationsForm />
      </Suspense>
    </div>
  )
}
