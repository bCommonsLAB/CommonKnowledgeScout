import { Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { ChatForm } from "@/components/settings/chat-form"

function ChatFormWrapper() {
  return <ChatForm />
}

export default function ChatSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Chat</h3>
        <p className="text-sm text-muted-foreground">
          Konfigurieren Sie die Chat-Einstellungen für die aktuell ausgewählte Bibliothek.
        </p>
      </div>
      <Separator />
      <Suspense fallback={<div className="text-center text-muted-foreground">Lädt...</div>}>
        <ChatFormWrapper />
      </Suspense>
    </div>
  )
}


