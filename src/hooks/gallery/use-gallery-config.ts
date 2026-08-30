'use client'

import { useMemo } from 'react'
import { useLibraries } from '@ks/shell/react'
import type { GalleryTexts } from '@/lib/gallery/types'
import { useTranslation } from '@ks/i18n/react'
// Alle unterstuetzten DetailViewTypes kommen aus der zentralen Registry —
// hier stand frueher eine eigene Kopie der Liste (Galerie-Audit, Befund 3c).
import type { DetailViewType } from '@ks/contracts'

/**
 * Hook für Gallery-Konfiguration.
 *
 * Textquelle in dieser Reihenfolge:
 * 1. Per-Library-Texte aus `config.publicPublishing.gallery` (Settings →
 *    Veröffentlichung → „Galerie-Texte“). Formular-Semantik: „Leer lassen für
 *    die Standard-Texte“ — ein leeres Feld ist also die EXPLIZITE Wahl des
 *    Übersetzungs-Defaults, kein stiller Fallback.
 * 2. Übersetzungs-Defaults basierend auf detailViewType.
 *
 * @param defaults - Nicht mehr verwendet, bleibt für Kompatibilität
 * @param libraryId - ID der Library (für die per-Library-Texte aus dem Atom)
 * @param initialDetailViewType - Initialer detailViewType aus dem librariesAtom (verhindert Flackern)
 */
export function useGalleryConfig(
  defaults: GalleryTexts,
  libraryId?: string,
  initialDetailViewType?: DetailViewType
) {
  const { t } = useTranslation()
  const libraries = useLibraries()
  const configured = libraries.find((lib) => lib.id === libraryId)?.config?.publicPublishing?.gallery

  // Verwende initialDetailViewType direkt - kein State-Management mehr nötig
  const detailViewType = initialDetailViewType || 'book'

  // Fallback auf 'book' für neue ViewTypes ohne eigene Übersetzungen
  const texts = useMemo<GalleryTexts>(() => {
    const viewType = detailViewType === 'session' ? 'session' : 'book'
    const pick = (value: string | undefined, key: string): string =>
      value && value.trim().length > 0 ? value : t(`gallery.texts.${viewType}.${key}`)
    return {
      headline: pick(configured?.headline, 'headline'),
      subtitle: pick(configured?.subtitle, 'subtitle'),
      description: pick(configured?.description, 'description'),
      filterDescription: pick(configured?.filterDescription, 'filterDescription'),
    }
  }, [configured, detailViewType, t])

  return { texts, detailViewType }
}
