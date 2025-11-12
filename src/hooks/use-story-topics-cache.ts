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
import type { AnswerLength, Retriever, TargetLanguage, SocialContext } from '@/lib/chat/constants'
import { useSessionHeaders } from './use-session-headers'
import { TOC_QUESTION } from '@/lib/chat/constants'

interface TOCCacheResult {
  found: boolean
  answer?: string
  references?: ChatResponse['references']
  suggestedQuestions?: string[]
  queryId?: string
  createdAt?: string
  storyTopicsData?: StoryTopicsData
  // Parameter aus Query, damit sie direkt verwendet werden können
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: string
  socialContext?: SocialContext
  facetsSelected?: Record<string, unknown>
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

      const urlParams = new URLSearchParams()
      urlParams.set('question', TOC_QUESTION)
      urlParams.set('targetLanguage', targetLanguage)
      urlParams.set('character', character)
      urlParams.set('socialContext', socialContext)
      urlParams.set('genderInclusive', String(genderInclusive))
      // WICHTIG: Kein retriever-Parameter mehr, da TOC-Queries mit verschiedenen Retrievern
      // (summary, chunkSummary) gespeichert werden können. Der Cache-Check sollte alle finden.

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


