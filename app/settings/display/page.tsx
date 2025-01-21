import { Separator } from "@/components/ui/separator"
import { DisplayForm } from "@/components/settings/display-form"

export default function DisplayPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Anzeige</h3>
        <p className="text-sm text-muted-foreground">
          Konfigurieren Sie Ihre Anzeigeeinstellungen.
        </p>
      </div>
      <Separator />
      <DisplayForm />
    </div>
  )
} 