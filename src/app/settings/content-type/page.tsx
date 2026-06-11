import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { ContentTypeForm } from "@/components/settings/chat"

export const metadata: Metadata = {
  title: "Bibliothek - Inhaltstyp",
  description: "Legen Sie fest, was Ihre Bibliothek enthält.",
}

// meSpace > Inhaltstyp (Welle 3-IV-UX-3a, F5)
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
    </div>
  )
}
