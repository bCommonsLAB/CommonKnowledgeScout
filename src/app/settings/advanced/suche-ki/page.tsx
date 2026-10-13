import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from '@ks/ui'
import { ChatAdvancedForm } from "@/components/settings/chat"

export const metadata: Metadata = {
  title: "Bibliothek - Erweitert · Suche & KI",
  description: "Suche, Sprachmodell, Facetten und Bild-Speicher der Bibliothek.",
}

// Erweitert · Suche & KI (Plan speicher-verbindungen-und-library-anlage, Teil B)
export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Suche & KI</h3>
        <p className="text-sm text-muted-foreground">Wie die Bibliothek sucht und antwortet — RAG, Sprachmodell, Facetten, Graph-Encoding — und wo Bilder liegen.</p>
      </div>
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <ChatAdvancedForm />
      </Suspense>
    </div>
  )
}
