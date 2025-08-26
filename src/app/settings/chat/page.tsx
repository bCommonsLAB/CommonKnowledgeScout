import { Separator } from "@/components/ui/separator"
import { ChatForm } from "@/components/settings/chat-form"

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
      <ChatForm />
    </div>
  )
}


