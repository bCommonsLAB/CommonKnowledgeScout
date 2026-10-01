/**
 * „Uebersicht neu berechnen"-Hinweis (D6, aus chat-panel.tsx ausgegliedert):
 * Weichen die aktuellen Parameter (Sprache, Charakter, Kontext, Filter) von
 * denen der gecachten Themenuebersicht ab, zeigt die Mitte den Knopf.
 * Verhalten 1:1 portiert.
 */

import { useEffect, useState } from 'react'
import type { GalleryFilters } from '@ks/contracts'
import type { QueryLog } from '@/types/query-log'
import type { Character, SocialContext, TargetLanguage } from '@/lib/chat/constants'

export interface UseTocReloadHintParams {
  libraryId: string
  cachedTOCQueryId: string | undefined
  targetLanguage: TargetLanguage
  character: Character[]
  socialContext: SocialContext
  galleryFilters: GalleryFilters | undefined
  sessionHeaders: Record<string, string>
}

function normalizeFilters(filters: GalleryFilters | Record<string, unknown>): Record<string, string[]> {
  const normalized: Record<string, string[]> = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) normalized[key] = value.map((v) => String(v)).sort()
    else if (value !== undefined && value !== null) normalized[key] = [String(value)].sort()
  })
  return normalized
}

export function useTocReloadHint({
  libraryId,
  cachedTOCQueryId,
  targetLanguage,
  character,
  socialContext,
  galleryFilters,
  sessionHeaders,
}: UseTocReloadHintParams): boolean {
  const [showReloadButton, setShowReloadButton] = useState(false)

  useEffect(() => {
    if (!cachedTOCQueryId || !libraryId) {
      setShowReloadButton(false)
      return
    }
    let cancelled = false

    async function compareParams() {
      if (!cachedTOCQueryId) return
      try {
        const queryRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(cachedTOCQueryId)}`, {
          cache: 'no-store',
          headers: Object.keys(sessionHeaders).length > 0 ? sessionHeaders : undefined,
        })
        if (!queryRes.ok || cancelled) {
          // Query nicht (mehr) da (404): kein Hinweis, kein Fehler.
          if (queryRes.status === 404) setShowReloadButton(false)
          return
        }
        const queryLog = (await queryRes.json()) as QueryLog
        if (cancelled) return

        // cacheParams (neue Eintraege) vor Root-Feldern (alte Eintraege)
        const queryParams = {
          targetLanguage: queryLog.cacheParams?.targetLanguage ?? queryLog.targetLanguage,
          character: queryLog.cacheParams?.character ?? queryLog.character,
          socialContext: queryLog.cacheParams?.socialContext ?? queryLog.socialContext,
          facetsSelected: queryLog.cacheParams?.facetsSelected ?? queryLog.facetsSelected ?? {},
        }
        const paramsMatch =
          queryParams.targetLanguage === targetLanguage &&
          queryParams.character === character &&
          queryParams.socialContext === socialContext &&
          JSON.stringify(normalizeFilters(queryParams.facetsSelected)) === JSON.stringify(normalizeFilters(galleryFilters || {}))
        setShowReloadButton(!paramsMatch)
      } catch (error) {
        console.error('[ChatPanel] Fehler beim Vergleich der Parameter:', error)
        setShowReloadButton(false)
      }
    }

    void compareParams()
    return () => {
      cancelled = true
    }
  }, [cachedTOCQueryId, libraryId, targetLanguage, character, socialContext, galleryFilters, sessionHeaders])

  return showReloadButton
}
