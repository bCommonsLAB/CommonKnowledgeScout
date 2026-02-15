'use client'

import { useMemo } from 'react'
import type { GalleryTexts } from '@/lib/gallery/types'
import { useTranslation } from '@/lib/i18n/hooks'

/** Alle unterstützten DetailViewTypes */
type DetailViewType = 'book' | 'session' | 'climateAction' | 'testimonial' | 'blog' | 'divaDocument'

/**
 * Hook für Gallery-Konfiguration
 * Verwendet Übersetzungen basierend auf detailViewType
 * 
 * @param defaults - Nicht mehr verwendet, bleibt für Kompatibilität
 * @param libraryId - ID der Library (nicht mehr verwendet, bleibt für Kompatibilität)
 * @param initialDetailViewType - Initialer detailViewType aus dem librariesAtom (verhindert Flackern)
 */
export function useGalleryConfig(
  defaults: GalleryTexts, 
  libraryId?: string,
  initialDetailViewType?: DetailViewType
) {
  const { t } = useTranslation()
  
  // Verwende initialDetailViewType direkt - kein State-Management mehr nötig
  const detailViewType = initialDetailViewType || 'book'

  // Verwende Übersetzungen basierend auf detailViewType
  // Fallback auf 'book' für neue ViewTypes ohne eigene Übersetzungen
  const texts = useMemo<GalleryTexts>(() => {
    const viewType = detailViewType === 'session' ? 'session' : 'book'
    return {
      headline: t(`gallery.texts.${viewType}.headline`),
      subtitle: t(`gallery.texts.${viewType}.subtitle`),
      description: t(`gallery.texts.${viewType}.description`),
      filterDescription: t(`gallery.texts.${viewType}.filterDescription`),
    }
  }, [detailViewType, t])

  return { texts, detailViewType }
}


