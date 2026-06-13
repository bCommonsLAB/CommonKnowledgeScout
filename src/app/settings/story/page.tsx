import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { ChatForm } from "@/components/settings/chat-form"

export const metadata: Metadata = {
  title: "Bibliothek - Story",
  description: "Wie das Gespräch mit Ihren Inhalten klingt.",
}

// meSpace > Story (User-Entscheid 2026-06-11): entspricht dem
// Story-Modus der App-Navigation (Chat mit den Inhalten).
export default function StorySettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Story</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Im Story-Modus führen Besucher ein Gespräch mit Ihren Inhalten.
          Hier bestimmen Sie die Texte des Eingabefelds sowie Sprache und
          Tonfall der Antworten.
        </p>
      </div>
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <ChatForm />
      </Suspense>
    </div>
  )
}
