/**
 * Hook für Story-Topics-Cache (TOC)
 * 
 * Verwaltet das Prüfen und Laden des TOC-Caches für eine Bibliothek.
 * Wird sowohl im Chat als auch in der Gallery verwendet.
 */

import { useCallback } from 'react'
import type { StoryTopicsData } from '@/types/story-topics'
import type { ChatResponse } from '@/types/chat-response'
import type { GalleryFilters } from '@/atoms/gallery-filters'
import { useSessionHeaders } from './use-session-headers'

interface TOCCacheResult {
  found: boolean
  answer?: string
  references?: ChatResponse['references']
  suggestedQuestions?: string[]
  queryId?: string
  createdAt?: string
  storyTopicsData?: StoryTopicsData
}

interface CheckTOCCacheParams {
  libraryId: string
  targetLanguage: string
  character: string
  socialContext: string
  genderInclusive: boolean
  galleryFilters?: GalleryFilters
}

/**
 * Hook für Story-Topics-Cache-Prüfung
 * 
 * Baut die Cache-URL mit allen notwendigen Parametern und prüft den Cache.
 * 
 * @param params - Parameter für Cache-Prüfung
 * @returns Funktion zum Prüfen des Caches
 */
export function useStoryTopicsCache() {
  const sessionHeaders = useSessionHeaders()

  const checkCache = useCallback(
    async (params: CheckTOCCacheParams): Promise<TOCCacheResult | null> => {
      const { libraryId, targetLanguage, character, socialContext, genderInclusive, galleryFilters } =
        params

      const tocQuestion =
        'Welche Themen werden hier behandelt, können wir die übersichtlich als Inhaltsverzeichnis ausgeben.'
      const urlParams = new URLSearchParams()
      urlParams.set('question', tocQuestion)
      urlParams.set('targetLanguage', targetLanguage)
      urlParams.set('character', character)
      urlParams.set('socialContext', socialContext)
      urlParams.set('genderInclusive', String(genderInclusive))
      urlParams.set('retriever', 'summary')

      // Füge Filter-Parameter hinzu
      if (galleryFilters) {
        Object.entries(galleryFilters).forEach(([key, values]) => {
          if (Array.isArray(values) && values.length > 0) {
            values.forEach((value) => {
              urlParams.append(key, String(value))
            })
          }
        })
      }

      const cacheUrl = `/api/chat/${encodeURIComponent(libraryId)}/toc-cache?${urlParams.toString()}`

      try {
        const res = await fetch(cacheUrl, {
          cache: 'no-store',
          headers: Object.keys(sessionHeaders).length > 0 ? sessionHeaders : undefined,
        })

        if (!res.ok) {
          return null
        }

        const data = (await res.json()) as TOCCacheResult
        return data
      } catch {
        return null
      }
    },
    [sessionHeaders]
  )

  return { checkCache }
}


