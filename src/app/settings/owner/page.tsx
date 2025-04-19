import { Separator } from "@/components/ui/separator"
import { OwnerForm } from "@/components/settings/owner-form"

export default function OwnerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Konto</h3>
        <p className="text-sm text-muted-foreground">
          Verwalten Sie Ihre Kontoeinstellungen.
        </p>
      </div>
      <Separator />
      <OwnerForm />
    </div>
  )
} 