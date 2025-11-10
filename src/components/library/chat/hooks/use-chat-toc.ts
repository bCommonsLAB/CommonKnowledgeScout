/**
 * Hook für TOC (Table of Contents) / Story Topics Cache
 * 
 * Verwaltet TOC-Cache-Prüfung, Generierung und State-Management.
 * Wird nur im Chat verwendet.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { StoryTopicsData } from '@/types/story-topics'
import type { ChatResponse } from '@/types/chat-response'
import type { TargetLanguage, Character, SocialContext } from '@/lib/chat/constants'
import type { GalleryFilters } from '@/atoms/gallery-filters'
import { useStoryTopicsCache } from '@/hooks/use-story-topics-cache'

interface CachedTOC {
  answer: string
  references?: ChatResponse['references']
  suggestedQuestions?: string[]
  queryId: string
  createdAt: string
}

interface UseChatTOCParams {
  libraryId: string
  cfg: { config: unknown } | null
  targetLanguage: TargetLanguage
  character: Character
  socialContext: SocialContext
  genderInclusive: boolean
  galleryFilters?: GalleryFilters
  isEmbedded: boolean
  isSending: boolean
  sendQuestion?: (question: string, retriever?: 'chunk' | 'doc' | 'summary' | 'auto', isTOCQuery?: boolean) => Promise<void>
}

interface UseChatTOCResult {
  cachedStoryTopicsData: StoryTopicsData | null
  cachedTOC: CachedTOC | null
  isCheckingTOC: boolean
  generateTOC: () => Promise<void>
  checkCache: () => Promise<void>
  setTOCData: (data: {
    storyTopicsData?: StoryTopicsData
    answer: string
    references: ChatResponse['references']
    suggestedQuestions: string[]
    queryId: string
  }) => void
}

/**
 * Hook für TOC-Cache-Management
 * 
 * @param params - Parameter für TOC-Management
 * @returns Cache-Daten, Checking-Status und Funktionen
 */
export function useChatTOC(params: UseChatTOCParams): UseChatTOCResult {
  const {
    libraryId,
    cfg,
    targetLanguage,
    character,
    socialContext,
    genderInclusive,
    galleryFilters,
    isEmbedded,
    isSending,
    sendQuestion,
  } = params

  const [cachedStoryTopicsData, setCachedStoryTopicsData] = useState<StoryTopicsData | null>(null)
  const [cachedTOC, setCachedTOC] = useState<CachedTOC | null>(null)
  const [isCheckingTOC, setIsCheckingTOC] = useState(false)
  const { checkCache: checkCacheAPI } = useStoryTopicsCache()

  // Ref für synchrones Tracking, ob Cache-Check läuft (verhindert Race Conditions)
  const isCheckingTOCRef = useRef(false)
  // Ref für verfolgen, ob ein Cache-Check gerade abgeschlossen wurde und Generierung nötig ist
  const shouldGenerateAfterCacheCheckRef = useRef(false)
  // Ref für sendQuestion, falls es später gesetzt wird
  const sendQuestionRef = useRef(sendQuestion)
  
  // Aktualisiere Ref, wenn sendQuestion sich ändert
  useEffect(() => {
    sendQuestionRef.current = sendQuestion
  }, [sendQuestion])

  const checkCache = useCallback(async () => {
    if (!cfg) {
      return
    }

    // Setze Ref synchron, bevor State-Update (verhindert Race Condition)
    isCheckingTOCRef.current = true
    setIsCheckingTOC(true)

    try {
      const result = await checkCacheAPI({
        libraryId,
        targetLanguage,
        character,
        socialContext,
        genderInclusive,
        galleryFilters,
      })

      if (result?.found && result.queryId) {
        // Priorisiere storyTopicsData über answer
        if (result.storyTopicsData) {
          setCachedStoryTopicsData(result.storyTopicsData)
          // Setze auch cachedTOC für Rückwärtskompatibilität
          setCachedTOC({
            answer: result.answer || '',
            references: result.references,
            suggestedQuestions: result.suggestedQuestions,
            queryId: result.queryId,
            createdAt: result.createdAt || new Date().toISOString(),
          })
        } else if (result.answer) {
          // Fallback: Normale Antwort (für alte Caches)
          setCachedTOC({
            answer: result.answer,
            references: result.references,
            suggestedQuestions: result.suggestedQuestions,
            queryId: result.queryId,
            createdAt: result.createdAt || new Date().toISOString(),
          })
          setCachedStoryTopicsData(null)
        } else {
          setCachedTOC(null)
          setCachedStoryTopicsData(null)
        }
      } else {
        // KEIN Cache gefunden
        setCachedTOC(null)
        setCachedStoryTopicsData(null)
        // Setze Flag für Generierung (nur im embedded-Modus)
        if (isEmbedded && !isSending) {
          shouldGenerateAfterCacheCheckRef.current = true
        }
      }
    } catch {
      // Bei Fehler: Setze Flag für Generierung
      setCachedTOC(null)
      setCachedStoryTopicsData(null)
      if (isEmbedded && !isSending) {
        shouldGenerateAfterCacheCheckRef.current = true
      }
    } finally {
      isCheckingTOCRef.current = false
      setIsCheckingTOC(false)
    }
  }, [
    cfg,
    libraryId,
    targetLanguage,
    character,
    socialContext,
    genderInclusive,
    galleryFilters,
    isEmbedded,
    isSending,
    checkCacheAPI,
  ])

  // Exponiere checkCache für externe Aufrufe (z.B. nach TOC-Query-Löschung)
  const checkCacheExposed = useCallback(async () => {
    await checkCache()
  }, [checkCache])

  const generateTOC = useCallback(async () => {
    if (isSending) {
      return // Verhindere doppelte Ausführung
    }

    // Wenn Cache-Check noch läuft, abbrechen
    if (isCheckingTOC || isCheckingTOCRef.current) {
      return
    }

    // Prüfe zuerst, ob bereits ein Cache vorhanden ist
    const hasCachedData = cachedStoryTopicsData || cachedTOC
    if (hasCachedData) {
      return
    }

    // Verwende Ref, falls sendQuestion später gesetzt wurde
    const currentSendQuestion = sendQuestionRef.current || sendQuestion
    if (!currentSendQuestion) {
      return // sendQuestion noch nicht verfügbar
    }

    const tocQuestion =
      'Welche Themen werden hier behandelt, können wir die übersichtlich als Inhaltsverzeichnis ausgeben.'
    // Starte die Anfrage direkt als TOC-Query
    await currentSendQuestion(tocQuestion, 'summary', true) // true = isTOCQuery
    // Nach erfolgreicher Generierung Cache prüfen
    setTimeout(() => {
      checkCache()
    }, 1000)
  }, [isSending, isCheckingTOC, cachedStoryTopicsData, cachedTOC, sendQuestion, checkCache])

  // useEffect: Reagiere darauf, wenn Cache geleert wurde UND Generierung nötig ist
  useEffect(() => {
    // Nur wenn: kein Cache vorhanden, Cache-Check abgeschlossen, Flag gesetzt, embedded-Modus, nicht gerade sendend
    if (
      !cachedStoryTopicsData &&
      !cachedTOC &&
      !isCheckingTOC &&
      shouldGenerateAfterCacheCheckRef.current &&
      isEmbedded &&
      !isSending
    ) {
      // Prüfe, ob sendQuestion verfügbar ist (über Ref)
      const currentSendQuestion = sendQuestionRef.current || sendQuestion
      if (currentSendQuestion) {
        shouldGenerateAfterCacheCheckRef.current = false // Reset Flag
        generateTOC()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedStoryTopicsData, cachedTOC, isCheckingTOC, isEmbedded, isSending, sendQuestion, generateTOC])

  // Funktion zum direkten Setzen von TOC-Daten (z.B. nach Stream-Complete)
  const setTOCData = useCallback(
    (data: {
      storyTopicsData?: StoryTopicsData
      answer: string
      references: ChatResponse['references']
      suggestedQuestions: string[]
      queryId: string
    }) => {
      if (data.storyTopicsData) {
        setCachedStoryTopicsData(data.storyTopicsData)
        // Setze auch cachedTOC für Rückwärtskompatibilität
        setCachedTOC({
          answer: data.answer,
          references: data.references,
          suggestedQuestions: data.suggestedQuestions,
          queryId: data.queryId,
          createdAt: new Date().toISOString(),
        })
      } else if (data.answer) {
        // Fallback: Normale Antwort
        setCachedTOC({
          answer: data.answer,
          references: data.references,
          suggestedQuestions: data.suggestedQuestions,
          queryId: data.queryId,
          createdAt: new Date().toISOString(),
        })
        setCachedStoryTopicsData(null)
      }
    },
    []
  )

  return {
    cachedStoryTopicsData,
    cachedTOC,
    isCheckingTOC,
    generateTOC,
    checkCache: checkCacheExposed,
    setTOCData,
  }
}

