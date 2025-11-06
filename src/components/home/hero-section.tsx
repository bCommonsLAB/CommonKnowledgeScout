import { Button } from "@/components/ui/button"
import { ArrowRight, BookOpen } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-muted/30 to-background">
      <div className="absolute inset-0 bg-[url('/abstract-network-pattern-subtle-light.jpg')] opacity-[0.03] bg-cover bg-center" />

      <div className="container relative mx-auto px-4 py-24 md:py-32 lg:py-40">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
            <BookOpen className="h-4 w-4" />
            Common Knowledge Libraries
          </div>

          <h1 className="mb-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-7xl">
            Befrage nicht die KI.
            <br />
            <span className="text-primary">Befrage kollektives Wissen</span> – deiner Wahl.
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl text-pretty">
            Jede Library ist ein kollektives Gedächtnis – aufgebaut aus echten Stimmen, Texten und Erfahrungen. Wähle
            eine Wissensbibliothek und beginne dein Gespräch.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="gap-2 text-base">
              Wissen entdecken
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base bg-transparent">
              Über das Projekt erfahren
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  )
}






