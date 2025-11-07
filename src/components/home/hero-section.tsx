import { Button } from "@/components/ui/button"
import { ArrowRight, BookOpen } from "lucide-react"
import Link from "next/link"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Hintergrundbild */}
      <div className="absolute inset-0 bg-[url('/images/FOSDEM_2025_Opening_Talk_from_the_speaker_perspective.jpg')] bg-cover bg-center" />
      
      {/* schwarzes Overlay mit 30% Transparenz zum Abschwächen des Bildes */}
      <div className="absolute inset-0 bg-black/60" />

      <div className="container relative mx-auto px-4 py-24 md:py-32 lg:py-40">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge mit hellem Hintergrund und dunklem Text für Kontrast */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white">
            <BookOpen className="h-4 w-4" />
            Common Knowledge Libraries
          </div>

          {/* Hauptüberschrift in weiß */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Befrage nicht die KI.
            <br />
            <span className="whitespace-nowrap">Befrage kollektives Wissen.</span>
          </h1>

          {/* Beschreibungstext in hellem Grau/Weiß */}
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/90 md:text-xl text-pretty">
            Jede Library ist ein kollektives Gedächtnis – aufgebaut aus echten Stimmen, Texten und Erfahrungen. Wähle
            eine Wissensbibliothek, erkunde sie und beginne dein Gespräch.
          </p>

          {/* Buttons mit invertierten Farben für dunklen Hintergrund */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="gap-2 text-base bg-white text-black hover:bg-white/90">
              Wissen entdecken
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base bg-transparent border-white/20 text-white hover:bg-white/10 hover:border-white/40">
              Über das Projekt erfahren
            </Button>
          </div>
        </div>
      </div>

      {/* Bild-Attribution - dezent unten rechts */}
      <div className="absolute bottom-4 right-4 z-10">
        <p className="text-xs text-white/60 hover:text-white/80 transition-colors">
          Bild:{' '}
          <Link 
            href="https://fosdem.org/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline"
          >
            FOSDEM
          </Link>
          {' '}·{' '}
          <Link 
            href="https://creativecommons.org/licenses/by/2.0/be/deed.en"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            CC BY 2.0 Belgium
          </Link>
        </p>
      </div>

      {/* Untere Trennlinie in hellem Grau für dunklen Hintergrund */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </section>
  )
}






