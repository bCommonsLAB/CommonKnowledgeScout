'use client'

import { Button } from '@ks/ui'
import { ArrowRight, BookOpen } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "@ks/i18n/react"
import { AppLogo } from "@/components/shared/app-logo"

export function HeroSection() {
  const { t } = useTranslation()
  
  return (
    <section className="relative overflow-hidden">
      {/* Hintergrundbild */}
      <div className="absolute inset-0 bg-[url('https://ragtempproject.blob.core.windows.net/knowledgescout/images/fosdem_2025_opening_talk.jpg')] bg-cover bg-center" />
      
      {/* schwarzes Overlay mit 30% Transparenz zum Abschwächen des Bildes */}
      <div className="absolute inset-0 bg-black/60" />

      <div className="container relative mx-auto px-4 py-8 md:py-10">
        <div className="mx-auto max-w-4xl text-center">
          {/* Logo */}
          <div className="mb-4 flex justify-center">
            <AppLogo size={64} />
          </div>

          {/* Badge mit hellem Hintergrund und dunklem Text für Kontrast */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white">
            <BookOpen className="h-3.5 w-3.5" />
            {t('home.hero.badge')}
          </div>

          {/* Hauptüberschrift in weiß: höchstens drei Zeilen, auch auf dem Handy */}
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl md:text-5xl">
            {t('home.hero.title')}
            <br />
            {t('home.hero.subtitle')}
          </h1>

          {/* Beschreibungstext in hellem Grau/Weiß */}
          <p className="mx-auto mb-6 max-w-2xl text-base leading-relaxed text-white/90 md:text-lg text-pretty">
            {t('home.hero.description')}
          </p>

          {/* Ein Knopf: zur Library-Liste */}
          <div className="flex justify-center">
            <Button className="gap-2 bg-white text-black hover:bg-white/90" asChild>
              <a href="#libraries">
                {t('home.hero.buttonDiscover')}
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Bild-Attribution - dezent unten rechts */}
      <div className="absolute bottom-4 right-4 z-10">
        <p className="text-xs text-white/60 hover:text-white/80 transition-colors">
          {t('home.hero.imageAttribution')}:{' '}
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
            {t('home.hero.imageAttributionCC')}
          </Link>
        </p>
      </div>

      {/* Untere Trennlinie in hellem Grau für dunklen Hintergrund */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </section>
  )
}






