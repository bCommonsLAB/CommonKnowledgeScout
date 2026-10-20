'use client'

import { ArrowRight } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'

/** Texte des Bands aus `publicPublishing.mitreden` (Formular oder Brücke). */
export interface MitredenTexte {
  headline?: string
  text?: string
  buttonLabel?: string
  href?: string
}

export interface MitredenBandProps {
  texte?: MitredenTexte
}

/**
 * Mitreden-Band (Plan galerie-buergeransicht, G5; Figma „Mitreden-Band" 2:159):
 * unter der Liste des geführten Profils, Überschrift und eine Zeile links,
 * Knopf rechts. Ein einfacher Link, kein Router — das Embed zeigt denselben
 * Baustein. Ohne Überschrift oder Ziel gibt es kein Band: nichts wird still
 * erfunden (no-silent-fallbacks).
 */
export function MitredenBand({ texte }: MitredenBandProps) {
  const { t } = useTranslation()
  const headline = texte?.headline?.trim()
  const href = texte?.href?.trim()
  if (!headline || !href) return null
  const text = texte?.text?.trim()
  const label = texte?.buttonLabel?.trim() || t('gallery.mitreden', { defaultValue: 'Mitreden' })
  return (
    <section
      data-mitreden-band
      aria-label={headline}
      className="my-6 flex flex-col gap-4 rounded-xl bg-primary px-6 py-6 text-primary-foreground lg:flex-row lg:items-center lg:justify-between lg:gap-8"
    >
      <div className="min-w-0 space-y-1">
        <h2 className="text-xl font-semibold leading-tight">{headline}</h2>
        {text && <p className="text-sm leading-relaxed text-primary-foreground/80">{text}</p>}
      </div>
      <a
        href={href}
        className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-background/90 lg:w-auto"
      >
        {label}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </section>
  )
}
