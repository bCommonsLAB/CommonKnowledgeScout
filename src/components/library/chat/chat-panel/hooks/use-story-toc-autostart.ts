/**
 * Themenuebersicht im Story-Modus automatisch pruefen und erzeugen (D6, aus
 * chat-panel.tsx ausgegliedert, Verhalten 1:1).
 *
 * Drei Effekte: (1) Cache-Pruefung beim Laden und bei geaenderten Filtern
 * oder Parametern, (2) Erzeugung, wenn die Pruefung nichts fand, (3) die
 * erste Pruefung, sobald `sendQuestion` verfuegbar wird. Die Merk-Refs teilt
 * sich der Hook mit `useStoryFilterEvents`, das sie bei Filter-Ereignissen
 * zuruecksetzt.
 */

import { useEffect, useRef, type MutableRefObject } from 'react'
import type { GalleryFilters, StoryTopicsData } from '@ks/contracts'
import type { ChatProcessingStep } from '@/types/chat-processing'
import { TOC_QUESTION, type Character, type SocialContext, type TargetLanguage } from '@/lib/chat/constants'
import type { ChatMessage } from '../../utils/chat-utils'
import type { CachedTOC } from '../../hooks/use-chat-toc/types'
import type { UseChatStreamResult } from '../../hooks/use-chat-stream/types'

export interface TocAutostartRefs {
  hasCheckedCacheRef: MutableRefObject<boolean>
  shouldAutoGenerateRef: MutableRefObject<boolean>
  lastFiltersRef: MutableRefObject<string>
  lastParamsRef: MutableRefObject<string>
}

export interface UseStoryTocAutostartParams {
  cfg: unknown
  isEmbedded: boolean
  perspectiveOpen: boolean
  isSending: boolean
  isCheckingTOC: boolean
  isGeneratingTOC: boolean
  messages: ChatMessage[]
  galleryFilters: GalleryFilters | undefined
  targetLanguage: TargetLanguage
  character: Character[]
  socialContext: SocialContext
  genderInclusive: boolean
  llmModel: string
  filteredDocsCount: number
  galleryDataLoading: boolean
  cachedStoryTopicsData: StoryTopicsData | null
  cachedTOC: CachedTOC | null
  sendQuestion: UseChatStreamResult['sendQuestion'] | undefined
  processingSteps: ChatProcessingStep[]
  checkTOCCache: () => Promise<void>
  generateTOC: () => Promise<void>
}

export function useStoryTocAutostart(p: UseStoryTocAutostartParams): TocAutostartRefs {
  const hasCheckedCacheRef = useRef(false)
  const shouldAutoGenerateRef = useRef(false)
  const lastFiltersRef = useRef<string>('')
  const lastParamsRef = useRef<string>('')
  const {
    cfg, isEmbedded, perspectiveOpen, isSending, isCheckingTOC, isGeneratingTOC, messages, galleryFilters,
    targetLanguage, character, socialContext, genderInclusive, llmModel, filteredDocsCount, galleryDataLoading,
    cachedStoryTopicsData, cachedTOC, sendQuestion, processingSteps, checkTOCCache, generateTOC,
  } = p

  // (1) Cache-Pruefung — nur im Story-Modus, nur fuer die Themenuebersicht, nicht waehrend eine Frage laeuft.
  useEffect(() => {
    if (!cfg || !isEmbedded || perspectiveOpen || isSending) return
    const hasNormalQuestions = messages.some((msg) => msg.type === 'question' && msg.content.trim() !== TOC_QUESTION.trim())
    if (hasNormalQuestions) return

    const currentFiltersKey = JSON.stringify(galleryFilters || {})
    const currentParamsKey = JSON.stringify({ targetLanguage, character, socialContext, genderInclusive, llmModel })
    const filtersChanged = lastFiltersRef.current !== currentFiltersKey
    const paramsChanged = lastParamsRef.current !== currentParamsKey
    if (filtersChanged || paramsChanged) {
      hasCheckedCacheRef.current = false
      lastFiltersRef.current = currentFiltersKey
      lastParamsRef.current = currentParamsKey
    }
    if (hasCheckedCacheRef.current && !filtersChanged && !paramsChanged) return
    // Erst mit Dokumenten und mit Modell (sonst kein konsistenter Cache-Schluessel).
    if (filteredDocsCount < 1 || galleryDataLoading) return
    if (!llmModel) return
    hasCheckedCacheRef.current = true
    shouldAutoGenerateRef.current = true
    void checkTOCCache()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, isEmbedded, perspectiveOpen, isSending, galleryFilters, targetLanguage, character, socialContext, genderInclusive, llmModel, messages, filteredDocsCount, galleryDataLoading])

  // (2) Erzeugung beim ersten Laden oder wenn die Pruefung nichts fand — erst nach abgeschlossener Pruefung.
  useEffect(() => {
    if (!isEmbedded) return
    if (isSending || isCheckingTOC || isGeneratingTOC) return
    if (cachedStoryTopicsData || cachedTOC) {
      shouldAutoGenerateRef.current = false
      return
    }
    if (!sendQuestion || !llmModel) return
    if (filteredDocsCount < 1 || galleryDataLoading) return

    const hasCacheCheckSteps = processingSteps.some((s) => s.type === 'cache_check' || s.type === 'cache_check_complete')
    const cacheCheckComplete = processingSteps.some((s) => s.type === 'cache_check_complete')
    if (!shouldAutoGenerateRef.current && (!hasCacheCheckSteps || !cacheCheckComplete)) return

    // 300 ms, damit die Schritte der Pruefung sichtbar werden; dann nochmal auf Cache pruefen.
    shouldAutoGenerateRef.current = false
    setTimeout(() => {
      if (cachedStoryTopicsData || cachedTOC) return
      void generateTOC()
    }, 300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedStoryTopicsData, cachedTOC, isCheckingTOC, isEmbedded, sendQuestion, isSending, isGeneratingTOC, processingSteps, filteredDocsCount, galleryDataLoading, llmModel])

  // (3) Erste Pruefung, sobald sendQuestion von undefined zu definiert wechselt.
  const prevSendQuestionRef = useRef<typeof sendQuestion>(undefined)
  useEffect(() => {
    const vorher = prevSendQuestionRef.current
    prevSendQuestionRef.current = sendQuestion
    if (!cfg || !isEmbedded || perspectiveOpen) return
    if (cachedStoryTopicsData || cachedTOC) return
    if (hasCheckedCacheRef.current) return
    if (vorher === undefined && sendQuestion !== undefined) {
      if (filteredDocsCount < 1 || galleryDataLoading) return
      hasCheckedCacheRef.current = true
      shouldAutoGenerateRef.current = true
      void checkTOCCache()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendQuestion, cfg, isEmbedded, perspectiveOpen, cachedStoryTopicsData, cachedTOC, checkTOCCache, filteredDocsCount, galleryDataLoading])

  return { hasCheckedCacheRef, shouldAutoGenerateRef, lastFiltersRef, lastParamsRef }
}
