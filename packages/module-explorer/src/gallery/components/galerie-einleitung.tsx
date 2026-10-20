'use client'

import type { GalleryTexts } from '../lib/types'

export interface GalerieEinleitungProps {
  /** Die Galerie-Texte der Library (`publicPublishing.gallery`, sonst Vorgaben) — Entscheid 19.10.: keine eigenen Felder. */
  texte: Pick<GalleryTexts, 'headline' | 'subtitle' | 'description'>
}

/**
 * Einleitungs-Band des geführten Profils (G2): Kennzeile, Titel, Erklärung
 * in einem Satz — statt der Kopfzeile mit Klapp-Erklärung der Experten.
 */
export function GalerieEinleitung({ texte }: GalerieEinleitungProps) {
  const { headline, subtitle, description } = texte
  if (!headline.trim() && !description.trim()) return null
  return (
    // G6 (Owner 19.10.): kein eigener Kasten, buendig mit Leiste und Karten (Figma: Einleitung
    // liegt direkt auf der Seite); die Breite gibt die Liste vor, nicht eine zentrierte Spalte.
    <section className="py-6 sm:py-8" data-galerie-einleitung>
      <div className="space-y-2">
        {subtitle.trim() ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{subtitle}</p>
        ) : null}
        {headline.trim() ? <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">{headline}</h2> : null}
        {description.trim() ? (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
        ) : null}
      </div>
    </section>
  )
}
