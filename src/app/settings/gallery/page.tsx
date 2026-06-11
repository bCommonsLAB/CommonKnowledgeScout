import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { GalleryForm } from "@/components/settings/chat"

export const metadata: Metadata = {
  title: "Bibliothek - Galerie",
  description: "Wie Besucher Inhalte in der Galerie finden.",
}

// meSpace > Galerie (Welle 3-IV-UX-3a, F5)
export default function GallerySettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Galerie</h3>
        <p className="text-sm text-muted-foreground">
          Wie Besucher Inhalte in der Galerie finden: Darstellung,
          Gruppierung, Filter und Wissens-Graph.
        </p>
      </div>
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <GalleryForm />
      </Suspense>
    </div>
  )
}
