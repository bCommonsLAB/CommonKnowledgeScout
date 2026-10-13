import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from '@ks/ui'
import { DivaForm } from "@/components/settings/library"

export const metadata: Metadata = {
  title: "Bibliothek - Erweitert · DIVA",
  description: "DIVA-Auswertung und Auto-Klassifikation der Bibliothek.",
}

// Erweitert · DIVA (Plan speicher-verbindungen-und-library-anlage, Teil B)
export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">DIVA</h3>
        <p className="text-sm text-muted-foreground">Liefersystem-Daten auswerten, Konfidenz-Schwelle der Auto-Klassifikation und Vorgaben der Dateiliste.</p>
      </div>
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <DivaForm />
      </Suspense>
    </div>
  )
}
