/**
 * Hook für TOC (Table of Contents) / Story Topics Cache
 * 
 * Verwaltet TOC-Cache-Prüfung, Generierung und State-Management.
 * Wird nur im Chat verwendet.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { StoryTopicsData } from '@/types/story-topics'
import type { ChatResponse } from '@/types/chat-response'
import type { TargetLanguage, Character, SocialContext, AnswerLength, Retriever } from '@/lib/chat/constants'
import { TOC_QUESTION } from '@/lib/chat/constants'
import type { GalleryFilters } from '@/atoms/gallery-filters'

interface CachedTOC {
  answer: string
  references?: ChatResponse['references']
  suggestedQuestions?: string[]
  queryId: string
  createdAt: string
  // Parameter aus Query, damit sie direkt verwendet werden können
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: Character[] // Array (kann leer sein)
  socialContext?: SocialContext
  facetsSelected?: Record<string, unknown>
}

interface UseChatTOCParams {
  libraryId: string
  cfg: { config: unknown } | null
  targetLanguage: TargetLanguage
  character: Character[] // Array (kann leer sein)
  socialContext: SocialContext
  genderInclusive: boolean
  galleryFilters?: GalleryFilters
  isEmbedded: boolean
  isSending: boolean
  sendQuestion?: (question: string, retriever?: 'chunk' | 'doc' | 'summary' | 'auto', isTOCQuery?: boolean) => Promise<void>
  setProcessingSteps?: React.Dispatch<React.SetStateAction<import('@/types/chat-processing').ChatProcessingStep[]>>
}

interface UseChatTOCResult {
  cachedStoryTopicsData: StoryTopicsData | null
  cachedTOC: CachedTOC | null
  isCheckingTOC: boolean
  isGeneratingTOC: boolean
  generateTOC: () => Promise<void>
  forceRegenerateTOC: () => Promise<void> // Erzwingt Neugenerierung auch bei vorhandenem Cache
  checkCache: () => Promise<void>
  setTOCData: (data: {
    storyTopicsData?: StoryTopicsData
    answer: string
    references: ChatResponse['references']
    suggestedQuestions: string[]
    queryId: string
    // Parameter aus Query/State
    answerLength?: AnswerLength
    retriever?: Retriever
    targetLanguage?: TargetLanguage
    character?: Character[] // Array (kann leer sein)
    socialContext?: SocialContext
    facetsSelected?: Record<string, unknown>
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
    isSending,
    sendQuestion,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isEmbedded, // Wird aktuell nicht verwendet, aber Teil der API für zukünftige Verwendung
  } = params

  const [cachedStoryTopicsData, setCachedStoryTopicsData] = useState<StoryTopicsData | null>(null)
  const [cachedTOC, setCachedTOC] = useState<CachedTOC | null>(null)
  const [isCheckingTOC] = useState(false)
  const [isGeneratingTOC, setIsGeneratingTOC] = useState(false)

  // Ref für sendQuestion, falls es später gesetzt wurde
  const sendQuestionRef = useRef(sendQuestion)
  // Ref für Debounce-Timer (für checkCacheExposed)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Ref für Tracking, ob gerade eine TOC-Generierung läuft (verhindert Endlosschleife)
  const isGeneratingTOCRef = useRef(false)
  
  // Aktualisiere Ref, wenn sendQuestion sich ändert
  useEffect(() => {
    sendQuestionRef.current = sendQuestion
  }, [sendQuestion])

  // Reset Generierungs-Flag, wenn isSending von true auf false geht (Generierung abgebrochen/fehlgeschlagen)
  // WICHTIG: Timeout hinzufügen, um Endlosschleifen zu verhindern
  const lastResetTimeRef = useRef<number>(0)
  useEffect(() => {
    // Wenn isSending von true auf false geht UND eine Generierung läuft,
    // bedeutet das, dass die Generierung abgebrochen wurde oder fehlgeschlagen ist
    if (!isSending && isGeneratingTOCRef.current) {
      // Prüfe, ob bereits Daten vorhanden sind (dann wurde setTOCData() bereits aufgerufen)
      if (!cachedStoryTopicsData && !cachedTOC) {
        // Verhindere zu häufige Resets (max. alle 5 Sekunden)
        const now = Date.now()
        if (now - lastResetTimeRef.current > 5000) {
          // Keine Daten vorhanden → Generierung wurde abgebrochen oder fehlgeschlagen
          console.log('[useChatTOC] Generierung abgebrochen oder fehlgeschlagen, reset Flag')
          isGeneratingTOCRef.current = false
          lastResetTimeRef.current = now
        }
      } else {
        // Daten vorhanden → Generierung erfolgreich, Flag wird von setTOCData zurückgesetzt
        isGeneratingTOCRef.current = false
      }
    }
  }, [isSending, cachedStoryTopicsData, cachedTOC])

  // Cache-Check erfolgt jetzt automatisch beim Senden einer Frage über stream/route.ts
  // Diese Funktion ist eine No-Op, da der Cache-Check jetzt Teil des Stream-Prozesses ist
  const checkCache = useCallback(async () => {
    // Cache-Check erfolgt automatisch beim Senden der TOC-Frage über generateTOC()
    // Die Cache-Daten werden dann über setTOCData() gesetzt, wenn die Antwort kommt
    // Diese Funktion bleibt für Rückwärtskompatibilität, macht aber nichts
    console.log('[useChatTOC] checkCache: Cache-Check erfolgt automatisch beim Senden der Frage')
  }, [])

  // Exponiere checkCache für externe Aufrufe (z.B. nach TOC-Query-Löschung)
  // Mit Debounce-Mechanismus, um wiederholte Aufrufe zu verhindern
  const checkCacheExposed = useCallback(async () => {
    // Lösche vorherigen Timer, falls vorhanden
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Setze neuen Timer für Debounce (300ms)
    debounceTimerRef.current = setTimeout(async () => {
      await checkCache()
      debounceTimerRef.current = null
    }, 300)
  }, [checkCache])
  
  // Cleanup: Lösche Timer beim Unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const generateTOC = useCallback(async () => {
    if (isSending) {
      return // Verhindere doppelte Ausführung
    }

    // Wenn bereits eine Generierung läuft, abbrechen
    if (isGeneratingTOCRef.current) {
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

    // Markiere Generierung als gestartet
    isGeneratingTOCRef.current = true
    setIsGeneratingTOC(true)

    try {
    // Starte die Anfrage direkt als TOC-Query
      // Verwende 'auto' für automatische Retriever-Entscheidung basierend auf Token-Budget
      await currentSendQuestion(TOC_QUESTION, 'auto', true) // true = isTOCQuery
      // HINWEIS: Kein automatischer checkCache() Aufruf mehr!
      // Stattdessen wird setTOCData() verwendet, wenn die Generierung abgeschlossen ist
      // (siehe chat-panel.tsx useEffect für processingSteps)
    } catch (error) {
      console.error('[useChatTOC] Fehler bei TOC-Generierung:', error)
      // Bei Fehler: Reset Flag, damit erneut versucht werden kann
      isGeneratingTOCRef.current = false
      setIsGeneratingTOC(false)
    }
    // HINWEIS: isGeneratingTOCRef wird zurückgesetzt, wenn setTOCData() aufgerufen wird
    // oder wenn die Generierung fehlschlägt (siehe catch-Block oben)
  }, [isSending, cachedStoryTopicsData, cachedTOC, sendQuestion])

  // Erzwingt Neugenerierung des TOC, auch wenn bereits ein Cache vorhanden ist
  const forceRegenerateTOC = useCallback(async () => {
    if (isSending) {
      return // Verhindere doppelte Ausführung
    }

    // Wenn bereits eine Generierung läuft, abbrechen
    if (isGeneratingTOCRef.current) {
      return
    }

    // Verwende Ref, falls sendQuestion später gesetzt wurde
    const currentSendQuestion = sendQuestionRef.current || sendQuestion
    if (!currentSendQuestion) {
      return // sendQuestion noch nicht verfügbar
    }

    // Lösche Cache, damit neuer Cache gesetzt werden kann
    setCachedStoryTopicsData(null)
    setCachedTOC(null)

    // Markiere Generierung als gestartet
    isGeneratingTOCRef.current = true
    setIsGeneratingTOC(true)

    try {
      // Starte die Anfrage direkt als TOC-Query
      // Verwende 'auto' für automatische Retriever-Entscheidung basierend auf Token-Budget
      await currentSendQuestion(TOC_QUESTION, 'auto', true) // true = isTOCQuery
    } catch (error) {
      console.error('[useChatTOC] Fehler bei TOC-Neugenerierung:', error)
      // Bei Fehler: Reset Flag, damit erneut versucht werden kann
      isGeneratingTOCRef.current = false
      setIsGeneratingTOC(false)
    }
  }, [isSending, sendQuestion])


  // Funktion zum direkten Setzen von TOC-Daten (z.B. nach Stream-Complete)
  const setTOCData = useCallback(
    (data: {
      storyTopicsData?: StoryTopicsData
      answer: string
      references: ChatResponse['references']
      suggestedQuestions: string[]
      queryId: string
      // Parameter aus Query/State
      answerLength?: AnswerLength
      retriever?: Retriever
      targetLanguage?: TargetLanguage
      character?: Character[] // Array (kann leer sein)
      socialContext?: SocialContext
      facetsSelected?: Record<string, unknown>
    }) => {
      // Reset Generierungs-Flag IMMER, da die Generierung jetzt abgeschlossen ist
      // (auch wenn keine Daten vorhanden sind, z.B. "No matching content found")
      isGeneratingTOCRef.current = false
      setIsGeneratingTOC(false)
      
      if (data.storyTopicsData) {
        setCachedStoryTopicsData(data.storyTopicsData)
        // Setze auch cachedTOC für Rückwärtskompatibilität (inkl. Parameter)
        setCachedTOC({
          answer: data.answer,
          references: data.references,
          suggestedQuestions: data.suggestedQuestions,
          queryId: data.queryId,
          createdAt: new Date().toISOString(),
          answerLength: data.answerLength,
          retriever: data.retriever,
          targetLanguage: data.targetLanguage,
          character: data.character,
          socialContext: data.socialContext,
          facetsSelected: data.facetsSelected,
        })
      } else if (data.answer) {
        // Fallback: Normale Antwort (auch wenn leer, z.B. "No matching content found")
        setCachedTOC({
          answer: data.answer,
          references: data.references,
          suggestedQuestions: data.suggestedQuestions,
          queryId: data.queryId,
          createdAt: new Date().toISOString(),
          answerLength: data.answerLength,
          retriever: data.retriever,
          targetLanguage: data.targetLanguage,
          character: data.character,
          socialContext: data.socialContext,
          facetsSelected: data.facetsSelected,
        })
        setCachedStoryTopicsData(null)
      } else {
        // Keine Daten vorhanden (z.B. Fehler oder keine Chunks gefunden)
        // Setze trotzdem cachedTOC auf null, um Flag zurückzusetzen
        setCachedTOC(null)
        setCachedStoryTopicsData(null)
      }
    },
    []
  )

  return {
    cachedStoryTopicsData,
    cachedTOC,
    isCheckingTOC,
    isGeneratingTOC,
    generateTOC,
    forceRegenerateTOC,
    checkCache: checkCacheExposed,
    setTOCData,
  }
}

