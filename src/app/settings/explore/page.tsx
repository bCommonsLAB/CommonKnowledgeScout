import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { GalleryForm } from "@/components/settings/chat"

export const metadata: Metadata = {
  title: "Bibliothek - Explore",
  description: "Wie Besucher Ihre Inhalte in der Galerie erkunden.",
}

// meSpace > Explore (User-Entscheid 2026-06-11): entspricht dem
// Explore-Bereich der App-Navigation.
export default function ExploreSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Explore</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Im Explore-Bereich erkunden Besucher Ihre Inhalte als Galerie:
          Karten zeigen die Dokumente, Facetten-Filter grenzen die Auswahl
          ein, Gruppierungen schaffen Überblick. Hier legen Sie fest, wie
          diese Galerie aussieht und welche Filter es gibt.
        </p>
      </div>
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <GalleryForm />
      </Suspense>
    </div>
  )
}
