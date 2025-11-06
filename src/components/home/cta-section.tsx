import { Button } from "@/components/ui/button"
import { Compass, Mail, Eye } from "lucide-react"

export function CTASection() {
  return (
    <section className="bg-gradient-to-b from-background to-muted/30 py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          {/* Lab Icon */}
          <div className="mb-8 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <span className="text-3xl">🧪</span>
            </div>
          </div>

          {/* Headline */}
          <h2 className="mb-6 text-center text-3xl font-bold tracking-tight md:text-4xl text-balance">
            Ein gemeinsames Adventure-Projekt
          </h2>

          {/* Description */}
          <div className="mb-10 space-y-4 text-center text-lg text-muted-foreground">
            <p className="text-pretty">
              Knowledge Scout ist kein fertiges Produkt, sondern ein offenes Labor – ein Adventure-Projekt in
              Entwicklung.
            </p>
            <p className="text-pretty">
              Wir experimentieren mit offenen Technologien, um herauszufinden, wie kollektives Wissen in Zukunft
              erfahrbar wird: durchs Hören, Lesen, Verstehen und gemeinsame Reflektieren.
            </p>
            <p className="text-pretty">
              Wenn dich das interessiert, bist du eingeladen, mitzudenken, zu testen oder selbst Libraries beizutragen.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="gap-2">
              <Compass className="h-5 w-5" />
              Mitforschen & Testen
            </Button>
            <Button size="lg" variant="outline" className="gap-2 bg-transparent">
              <Mail className="h-5 w-5" />
              Kontakt aufnehmen
            </Button>
            <Button size="lg" variant="outline" className="gap-2 bg-transparent">
              <Eye className="h-5 w-5" />
              Projekt ansehen
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}






