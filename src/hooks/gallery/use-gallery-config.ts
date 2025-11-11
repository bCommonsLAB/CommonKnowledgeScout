'use client'

import { useEffect, useState, useMemo } from 'react'
import type { GalleryTexts } from '@/lib/gallery/types'
import { useTranslation } from '@/lib/i18n/hooks'

/**
 * Hook für Gallery-Konfiguration
 * Lädt detailViewType und verwendet Übersetzungen basierend darauf
 * 
 * @param defaults - Nicht mehr verwendet, bleibt für Kompatibilität
 * @param libraryId - ID der Library
 * @param initialDetailViewType - Optional: Initialer detailViewType aus dem librariesAtom (verhindert Flackern)
 */
export function useGalleryConfig(
  defaults: GalleryTexts, 
  libraryId?: string,
  initialDetailViewType?: 'book' | 'session'
) {
  const { t } = useTranslation()
  // Verwende initialDetailViewType falls verfügbar, sonst 'book' als Fallback
  const [detailViewType, setDetailViewType] = useState<'book' | 'session'>(
    initialDetailViewType || 'book'
  )

  // Lade detailViewType aus der API (nur als Fallback, falls initialDetailViewType nicht verfügbar)
  useEffect(() => {
    // Wenn initialDetailViewType bereits gesetzt ist, überspringe API-Call
    if (initialDetailViewType) return

    let cancelled = false
    async function load() {
      if (!libraryId) return
      try {
        const url = `/api/chat/${encodeURIComponent(libraryId)}/config`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        const galleryConfig = (data?.config as { gallery?: { detailViewType?: string } })?.gallery
        if (cancelled) return
        const vt = galleryConfig?.detailViewType
        if (vt === 'book' || vt === 'session') setDetailViewType(vt)
      } catch {
        // ignore
      }
    }
    load()
    return () => { cancelled = true }
  }, [libraryId, initialDetailViewType])

  // Aktualisiere detailViewType wenn initialDetailViewType sich ändert
  useEffect(() => {
    if (initialDetailViewType && initialDetailViewType !== detailViewType) {
      setDetailViewType(initialDetailViewType)
    }
  }, [initialDetailViewType, detailViewType])

  // Verwende Übersetzungen basierend auf detailViewType
  const texts = useMemo<GalleryTexts>(() => {
    const viewType = detailViewType === 'session' ? 'session' : 'book'
    return {
      headline: t(`gallery.texts.${viewType}.headline`),
      subtitle: t(`gallery.texts.${viewType}.subtitle`),
      description: t(`gallery.texts.${viewType}.description`),
      filterDescription: t(`gallery.texts.${viewType}.filterDescription`),
    }
  }, [detailViewType, t])

  return { texts, detailViewType, setDetailViewType }
}


