import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from '@ks/ui'
import { StorageTwinsForm } from "@/components/settings/library"

export const metadata: Metadata = {
  title: "Bibliothek - Erweitert · Speicher & Twins",
  description: "Shadow-Twins, Dateisystem-Optionen und Scan-Ausschluss der Bibliothek.",
}

// Erweitert · Speicher & Twins (Plan speicher-verbindungen-und-library-anlage, Teil B)
export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Speicher & Twins</h3>
        <p className="text-sm text-muted-foreground">Shadow-Twin-Modus, Dateisystem-Optionen, Medien-Speicher-Strategie und Scan-Ausschluss.</p>
      </div>
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <StorageTwinsForm />
      </Suspense>
    </div>
  )
}
