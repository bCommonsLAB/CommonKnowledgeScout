import { Separator } from "@/components/ui/separator"
import { NotificationsForm } from "@/components/settings/notifications-form"

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Benachrichtigungen</h3>
        <p className="text-sm text-muted-foreground">
          Konfigurieren Sie, wie Sie Benachrichtigungen erhalten.
        </p>
      </div>
      <Separator />
      <NotificationsForm />
    </div>
  )
} 