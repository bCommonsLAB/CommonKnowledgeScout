import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { ContentTypeForm } from "@/components/settings/chat"
import { TranslationsForm } from "@/components/settings/translations-form"

export const metadata: Metadata = {
  title: "Bibliothek - Inhaltstyp",
  description: "Legen Sie fest, was Ihre Bibliothek enthält.",
}

// meSpace > Inhaltstyp (Welle 3-IV-UX-3a/3e, F5/F6)
export default function ContentTypeSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Inhaltstyp</h3>
        <p className="text-sm text-muted-foreground">
          Was enthält Ihre Bibliothek? Davon hängt ab, wie Dokumente in
          Galerie und Detailansicht dargestellt werden.
        </p>
      </div>
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <ContentTypeForm />
      </Suspense>
      {/* Dokument-Uebersetzungen: gehoeren fachlich zum Inhalt, nicht zum Chat
          (User-Entscheid 2026-06-11). */}
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <TranslationsForm />
      </Suspense>
    </div>
  )
}
