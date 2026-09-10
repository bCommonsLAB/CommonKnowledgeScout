'use client'

/**
 * @fileoverview Welche Detailansicht das Embed zu welchem Typ zeigt (M5).
 *
 * @description
 * Gegenstueck zu `DETAIL_RENDERERS` der App
 * (`src/components/library/gallery-detail-renderers.tsx`). Das Embed kann
 * bisher Buecher — AECED-Inhalte sind `book` (Owner 2026-09-09). `testimonial`
 * und `blog` zeigen wie in der App die Buch-Ansicht.
 *
 * Alle anderen Typen sagen ausdruecklich, dass es ihre Ansicht hier noch nicht
 * gibt, statt still eine falsche zu zeigen (no-silent-fallbacks). Der `Record`
 * haelt die Typgrenze: Ein neuer `detailViewType` ist hier ein Typfehler, bis
 * jemand entscheidet, was das Embed fuer ihn zeigt.
 *
 * @module components
 */

import type { DetailViewType } from '@ks/contracts'
import { useTranslation } from '@ks/i18n/react'
import type { DetailRenderer } from './detail-overlay'
import { BuchDetailRenderer } from './book-detail/book-detail-renderer'

const NichtEingebettet: DetailRenderer = () => {
  const { t } = useTranslation()
  return (
    <div className="p-4 text-sm text-muted-foreground">
      {t('gallery.embedViewUnavailable', {
        defaultValue: 'Diese Ansicht ist in der eingebetteten Galerie noch nicht verfügbar.',
      })}
    </div>
  )
}

export const EMBED_DETAIL_RENDERERS: Record<DetailViewType, DetailRenderer> = {
  book: BuchDetailRenderer,
  testimonial: BuchDetailRenderer,
  blog: BuchDetailRenderer,
  session: NichtEingebettet,
  climateAction: NichtEingebettet,
  divaDocument: NichtEingebettet,
  divaTexture: NichtEingebettet,
  refurbedDevice: NichtEingebettet,
  website: NichtEingebettet,
}
