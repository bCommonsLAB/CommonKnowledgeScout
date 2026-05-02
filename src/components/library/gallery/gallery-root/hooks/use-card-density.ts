'use client'

/**
 * src/components/library/gallery/gallery-root/hooks/use-card-density.ts
 *
 * Hook fuer Card-Density mit sessionStorage-Override.
 *
 * Aus gallery-root.tsx ausgegliedert (Welle 3-III-a, Schritt 2/N).
 *
 * Verhalten 1:1 portiert:
 * - Default: comfortable (vor Mount)
 * - Nach Mount: liest sessionStorage pro Library, sonst Config-Default
 * - handleChange schreibt in sessionStorage und in State
 * - Logging bei sessionStorage-Fehlern (kein silent fallback)
 */

import { useCallback, useEffect, useState } from 'react'
import {
  normalizeGalleryCardDensity,
  galleryCardDensityStorageKey,
  type GalleryCardDensity,
} from '@/lib/gallery/gallery-card-density'

export interface UseCardDensityArgs {
  libraryId: string | null | undefined
  /** Library-Default-Density (z.B. aus rawGalleryConfig.galleryCardDensity) */
  configDefault: GalleryCardDensity
}

export interface UseCardDensityResult {
  cardDensity: GalleryCardDensity
  setCardDensity: (density: GalleryCardDensity) => void
}

export function useCardDensity({ libraryId, configDefault }: UseCardDensityArgs): UseCardDensityResult {
  const [cardDensity, setCardDensityState] = useState<GalleryCardDensity>('comfortable')

  // Effektive Dichte: zuerst sessionStorage pro Library, sonst Config-Default.
  useEffect(() => {
    if (!libraryId) {
      setCardDensityState(configDefault)
      return
    }
    try {
      const stored = sessionStorage.getItem(galleryCardDensityStorageKey(libraryId))
      if (stored !== null) {
        setCardDensityState(normalizeGalleryCardDensity(stored))
        return
      }
    } catch (e) {
      // sessionStorage kann in privaten Browsern oder Embeds fehlschlagen.
      // Wir loggen die Ursache (no-silent-fallbacks.mdc) und greifen auf
      // den Library-Default zurueck.
      console.warn('[useCardDensity] sessionStorage (Karten-Dichte) lesen fehlgeschlagen:', e)
    }
    setCardDensityState(configDefault)
  }, [libraryId, configDefault])

  const setCardDensity = useCallback(
    (density: GalleryCardDensity) => {
      setCardDensityState(density)
      if (!libraryId) return
      try {
        sessionStorage.setItem(galleryCardDensityStorageKey(libraryId), density)
      } catch (e) {
        // siehe oben — bewusster console.warn statt stillem Catch
        console.warn('[useCardDensity] sessionStorage (Karten-Dichte) schreiben fehlgeschlagen:', e)
      }
    },
    [libraryId],
  )

  return { cardDensity, setCardDensity }
}
