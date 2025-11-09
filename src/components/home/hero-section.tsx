'use client'

import { Button } from "@/components/ui/button"
import { ArrowRight, BookOpen } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "@/lib/i18n/hooks"
import { useEffect, useState } from "react"
import { DEFAULT_LOCALE, t as translate } from "@/lib/i18n"

export function HeroSection() {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  
  // Verhindere Hydration-Mismatch: Warte bis Client gemountet ist
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Während SSR: Verwende Standard-Übersetzungen (verhindert Mismatch)
  // Nach Mount: Verwende Client-Übersetzungen
  const tSafe = mounted ? t : (key: string) => translate(DEFAULT_LOCALE, key)
  
  return (
    <section className="relative overflow-hidden">
      {/* Hintergrundbild */}
      <div className="absolute inset-0 bg-[url('https://ragtempproject.blob.core.windows.net/knowledgescout/images/fosdem_2025_opening_talk.jpg')] bg-cover bg-center" />
      
      {/* schwarzes Overlay mit 30% Transparenz zum Abschwächen des Bildes */}
      <div className="absolute inset-0 bg-black/60" />

      <div className="container relative mx-auto px-4 py-24 md:py-32 lg:py-40">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge mit hellem Hintergrund und dunklem Text für Kontrast */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white">
            <BookOpen className="h-4 w-4" />
            {tSafe('home.hero.badge')}
          </div>

          {/* Hauptüberschrift in weiß */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl md:text-6xl lg:text-7xl">
            {tSafe('home.hero.title')}
            <br />
            {tSafe('home.hero.subtitle')}
          </h1>

          {/* Beschreibungstext in hellem Grau/Weiß */}
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/90 md:text-xl text-pretty">
            {tSafe('home.hero.description')}
          </p>

          {/* Buttons mit invertierten Farben für dunklen Hintergrund */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="gap-2 text-base bg-white text-black hover:bg-white/90">
              {tSafe('home.hero.buttonDiscover')}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base bg-transparent border-white/20 text-white hover:bg-white/10 hover:border-white/40">
              {tSafe('home.hero.buttonLearnMore')}
            </Button>
          </div>
        </div>
      </div>

      {/* Bild-Attribution - dezent unten rechts */}
      <div className="absolute bottom-4 right-4 z-10">
        <p className="text-xs text-white/60 hover:text-white/80 transition-colors">
          {tSafe('home.hero.imageAttribution')}:{' '}
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
            {tSafe('home.hero.imageAttributionCC')}
          </Link>
        </p>
      </div>

      {/* Untere Trennlinie in hellem Grau für dunklen Hintergrund */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </section>
  )
}






