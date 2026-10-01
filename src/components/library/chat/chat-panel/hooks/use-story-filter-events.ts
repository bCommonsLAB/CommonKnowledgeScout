/**
 * Filter-Ereignisse der Galerie im Story-Modus (D6, aus chat-panel.tsx
 * ausgegliedert, Verhalten 1:1): `gallery-filters-cleared` prueft den Cache
 * der Themenuebersicht neu, `gallery-filters-changed` erzwingt die
 * Neuberechnung (nach 500 ms, wenn keine Anfrage laeuft). Beide setzen die
 * Merk-Refs von `useStoryTocAutostart` zurueck.
 */

import { useEffect } from 'react'
import type { GalleryFilters, StoryTopicsData } from '@ks/contracts'
import type { CachedTOC } from '../../hooks/use-chat-toc/types'
import type { TocAutostartRefs } from './use-story-toc-autostart'

export interface UseStoryFilterEventsParams {
  isEmbedded: boolean
  isSending: boolean
  isGeneratingTOC: boolean
  galleryFilters: GalleryFilters | undefined
  cachedStoryTopicsData: StoryTopicsData | null
  cachedTOC: CachedTOC | null
  checkTOCCache: () => Promise<void>
  forceRegenerateTOC: () => Promise<void>
  refs: TocAutostartRefs
}

export function useStoryFilterEvents({
  isEmbedded,
  isSending,
  isGeneratingTOC,
  galleryFilters,
  cachedStoryTopicsData,
  cachedTOC,
  checkTOCCache,
  forceRegenerateTOC,
  refs,
}: UseStoryFilterEventsParams): void {
  useEffect(() => {
    const handleFiltersCleared = () => {
      if (!isEmbedded) return
      refs.hasCheckedCacheRef.current = false
      void checkTOCCache()
    }
    window.addEventListener('gallery-filters-cleared', handleFiltersCleared)
    return () => window.removeEventListener('gallery-filters-cleared', handleFiltersCleared)
  }, [isEmbedded, checkTOCCache, refs])

  useEffect(() => {
    const handleFiltersChanged = () => {
      if (!isEmbedded) return
      if (isSending || isGeneratingTOC) return
      refs.hasCheckedCacheRef.current = false
      refs.lastFiltersRef.current = ''
      refs.shouldAutoGenerateRef.current = true
      // checkTOCCache ist hier wirkungslos — forceRegenerateTOC loescht den Cache und rechnet neu.
      setTimeout(() => {
        if (!isSending && !isGeneratingTOC) void forceRegenerateTOC()
      }, 500)
    }
    window.addEventListener('gallery-filters-changed', handleFiltersChanged)
    return () => window.removeEventListener('gallery-filters-changed', handleFiltersChanged)
  }, [isEmbedded, galleryFilters, isSending, isGeneratingTOC, cachedStoryTopicsData, cachedTOC, forceRegenerateTOC, refs])
}
