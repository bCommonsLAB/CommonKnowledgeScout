import { Metadata } from "next"
import { Separator } from '@ks/ui'
import { SprachmodelleSection } from "@/components/settings/account/sprachmodelle/sprachmodelle-section"

export const metadata: Metadata = {
  title: "Mein Konto - Sprachmodelle",
  description: "Die Sprachmodelle, die in allen Bibliotheken zur Auswahl stehen.",
}

// Mein Konto > Sprachmodelle — nur fuer den Admin der Plattform (KS_ADMIN_EMAIL).
export default function SprachmodellePage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Sprachmodelle</h3>
        <p className="text-sm text-muted-foreground">
          Welche Modelle in den Auswahlfeldern stehen — im Story-Modus und in den Einstellungen jeder
          Bibliothek. Ein Modell läuft über den Secretary; die Probe belegt das.
        </p>
      </div>
      <Separator />
      <SprachmodelleSection />
    </div>
  )
}
