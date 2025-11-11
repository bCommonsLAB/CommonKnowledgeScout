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
import { TOC_QUESTION } from '@/lib/chat/constants'
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
  // Ref für sendQuestion, falls es später gesetzt wurde
  const sendQuestionRef = useRef(sendQuestion)
  // Ref für Debounce-Timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Ref für letzten Cache-Check-Zeitpunkt (verhindert zu häufige Checks)
  const lastCheckTimeRef = useRef<number>(0)
  // Ref für Cache-Key (verhindert Checks mit identischen Parametern)
  const lastCacheKeyRef = useRef<string>('')
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

  const checkCache = useCallback(async () => {
    if (!cfg) {
      return
    }

    // Wenn bereits eine Generierung läuft, überspringe Check komplett
    // WICHTIG: Im Story-Mode können Facetten sich ändern (vom Gallery-Mode), aber wir sollten
    // keine neue Generierung starten, wenn bereits eine läuft
    if (isGeneratingTOCRef.current) {
      console.log('[useChatTOC] checkCache übersprungen: Generierung läuft bereits')
      return
    }
    
    // Wenn bereits Daten vorhanden sind, überspringe Check
    if (cachedStoryTopicsData || cachedTOC) {
      console.log('[useChatTOC] checkCache übersprungen: Cache bereits vorhanden')
      return
    }

    // Erstelle Cache-Key aus Parametern
    const cacheKey = JSON.stringify({
      libraryId,
      targetLanguage,
      character,
      socialContext,
      genderInclusive,
      galleryFilters,
    })
    
    // Wenn bereits ein Check mit denselben Parametern läuft oder gerade gelaufen ist, überspringe
    if (isCheckingTOCRef.current) {
      return
    }
    
    // Wenn derselbe Cache-Key wie beim letzten Check, überspringe (Debounce)
    // Erhöhe Debounce-Zeit auf 2 Sekunden, um häufige Filter-Änderungen abzufangen
    const now = Date.now()
    if (cacheKey === lastCacheKeyRef.current && now - lastCheckTimeRef.current < 2000) {
      return
    }
    
    // Setze Ref synchron, bevor State-Update (verhindert Race Condition)
    isCheckingTOCRef.current = true
    setIsCheckingTOC(true)
    lastCacheKeyRef.current = cacheKey
    lastCheckTimeRef.current = now

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
        // Generiere TOC direkt, wenn im embedded-Modus UND keine Generierung läuft
        // WICHTIG: Im Story-Mode können Facetten sich ändern (vom Gallery-Mode), aber wir sollten
        // keine neue Generierung starten, wenn bereits eine läuft
        // HINWEIS: isCheckingTOCRef wird im finally-Block zurückgesetzt, daher können wir hier
        // die Generierung starten, auch wenn der Check gerade läuft (der Check ist ja abgeschlossen)
        if (isEmbedded && !isSending && !isGeneratingTOCRef.current) {
          const currentSendQuestion = sendQuestionRef.current || sendQuestion
          if (currentSendQuestion) {
            // Setze Flag BEVOR wir sendQuestion aufrufen (verhindert parallele Aufrufe)
            isGeneratingTOCRef.current = true
            // Rufe generateTOC direkt auf (ohne Flag-Mechanismus)
            currentSendQuestion(TOC_QUESTION, 'auto', true).catch((error) => {
              console.error('[useChatTOC] Fehler bei TOC-Generierung:', error)
              isGeneratingTOCRef.current = false
            })
          }
        }
      }
    } catch {
      // Bei Fehler: Generiere TOC direkt, wenn im embedded-Modus UND keine Generierung läuft
      setCachedTOC(null)
      setCachedStoryTopicsData(null)
      if (isEmbedded && !isSending && !isGeneratingTOCRef.current) {
        const currentSendQuestion = sendQuestionRef.current || sendQuestion
        if (currentSendQuestion) {
          // Setze Flag BEVOR wir sendQuestion aufrufen (verhindert parallele Aufrufe)
          isGeneratingTOCRef.current = true
          currentSendQuestion(TOC_QUESTION, 'auto', true).catch((error) => {
            console.error('[useChatTOC] Fehler bei TOC-Generierung:', error)
            isGeneratingTOCRef.current = false
          })
        }
      }
    } finally {
      // Reset Check-Flag NACH der Generierungs-Entscheidung
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
    sendQuestion,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // cachedStoryTopicsData und cachedTOC sind nur Setter (stabil), nicht als Werte verwendet
  ])

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

    // Markiere Generierung als gestartet
    isGeneratingTOCRef.current = true

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
    }
    // HINWEIS: isGeneratingTOCRef wird zurückgesetzt, wenn setTOCData() aufgerufen wird
    // oder wenn die Generierung fehlschlägt (siehe catch-Block oben)
  }, [isSending, isCheckingTOC, cachedStoryTopicsData, cachedTOC, sendQuestion])


  // Funktion zum direkten Setzen von TOC-Daten (z.B. nach Stream-Complete)
  const setTOCData = useCallback(
    (data: {
      storyTopicsData?: StoryTopicsData
      answer: string
      references: ChatResponse['references']
      suggestedQuestions: string[]
      queryId: string
    }) => {
      // Reset Generierungs-Flag IMMER, da die Generierung jetzt abgeschlossen ist
      // (auch wenn keine Daten vorhanden sind, z.B. "No matching content found")
      isGeneratingTOCRef.current = false
      
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
        // Fallback: Normale Antwort (auch wenn leer, z.B. "No matching content found")
        setCachedTOC({
          answer: data.answer,
          references: data.references,
          suggestedQuestions: data.suggestedQuestions,
          queryId: data.queryId,
          createdAt: new Date().toISOString(),
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
    generateTOC,
    checkCache: checkCacheExposed,
    setTOCData,
  }
}

