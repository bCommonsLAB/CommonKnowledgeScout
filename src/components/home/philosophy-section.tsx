import { Card, CardContent } from "@/components/ui/card"
import { Shield, Eye, Users2 } from "lucide-react"

export function PhilosophySection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl text-balance">
              Transparenz statt Blackbox
            </h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
              Jede Antwort basiert auf offenen Daten, nachvollziehbaren Quellen und Menschen, die ihr Wissen teilen. Wir
              glauben, dass die Zukunft des Wissens nicht generiert, sondern geteilt wird.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-2">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                  <Eye className="h-7 w-7 text-accent" />
                </div>
                <h3 className="mb-2 font-semibold">Nachvollziehbar</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Alle Quellen sind transparent und überprüfbar
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                  <Users2 className="h-7 w-7 text-accent" />
                </div>
                <h3 className="mb-2 font-semibold">Menschlich</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Basiert auf echten Stimmen und Erfahrungen
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                  <Shield className="h-7 w-7 text-accent" />
                </div>
                <h3 className="mb-2 font-semibold">Vertrauenswürdig</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Kuratiert von Forschung und Communities</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 rounded-lg bg-muted/50 p-8 text-center">
            <h3 className="mb-3 text-xl font-semibold">Wer steht hinter den Libraries?</h3>
            <p className="leading-relaxed text-muted-foreground text-pretty">
              Diese Libraries werden gemeinsam mit Forschungseinrichtungen, NGOs und offenen Communities gepflegt. Jede
              kann eigene Themen, Metadaten und Werte einbringen.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}



