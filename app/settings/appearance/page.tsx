import { Separator } from "@/components/ui/separator"
import { AppearanceForm } from "@/components/settings/appearance-form"

export default function AppearancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Erscheinungsbild</h3>
        <p className="text-sm text-muted-foreground">
          Passen Sie das Erscheinungsbild der App an. Wählen Sie zwischen hell und dunkel.
        </p>
      </div>
      <Separator />
      <AppearanceForm />
    </div>
  )
} 