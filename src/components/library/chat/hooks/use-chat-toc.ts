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
import { useStoryTopicsCache } from '@/hooks/use-story-topics-cache'

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
  character?: string
  socialContext?: SocialContext
  facetsSelected?: Record<string, unknown>
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
    character?: string
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
    setProcessingSteps,
  } = params

  const [cachedStoryTopicsData, setCachedStoryTopicsData] = useState<StoryTopicsData | null>(null)
  const [cachedTOC, setCachedTOC] = useState<CachedTOC | null>(null)
  const [isCheckingTOC, setIsCheckingTOC] = useState(false)
  const [isGeneratingTOC, setIsGeneratingTOC] = useState(false)
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

    // WICHTIG: Überspringe Check NICHT mehr, wenn bereits eine Generierung läuft
    // Der Cache-Check sollte IMMER durchgeführt werden, bevor eine Generierung startet
    // Die Generierung wird durch die Bedingung in generateTOC() verhindert, wenn isCheckingTOC true ist
    
    // WICHTIG: Überspringe Check NICHT mehr, wenn bereits Daten vorhanden sind
    // Beim Seiten-Reload sollten die Daten zunächst leer sein, und der Check sollte
    // immer durchgeführt werden, um sicherzustellen, dass der Cache korrekt ist
    // Die Daten werden nur übersprungen, wenn bereits eine Generierung läuft

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

    // Füge Cache-Check-Step hinzu
    if (setProcessingSteps) {
      setProcessingSteps(prev => {
        // Entferne alte Cache-Check-Steps, falls vorhanden
        const filtered = prev.filter(s => s.type !== 'cache_check' && s.type !== 'cache_check_complete')
        return [...filtered, {
          type: 'cache_check',
          parameters: {
            targetLanguage,
            character,
            socialContext,
            filters: galleryFilters,
          },
        }]
      })
    }

    try {
      const result = await checkCacheAPI({
        libraryId,
        targetLanguage,
        character,
        socialContext,
        genderInclusive,
        galleryFilters,
      })

      // Füge Cache-Check-Complete-Step hinzu
      if (setProcessingSteps) {
        setProcessingSteps(prev => {
          // Entferne alte Cache-Check-Steps, falls vorhanden, und füge neuen Complete-Step hinzu
          const filtered = prev.filter(s => s.type !== 'cache_check' && s.type !== 'cache_check_complete')
          const cacheCheckStep = prev.find(s => s.type === 'cache_check')
          const newSteps = cacheCheckStep ? [cacheCheckStep] : []
          return [...filtered, ...newSteps, {
            type: 'cache_check_complete',
            found: result?.found || false,
            queryId: result?.queryId,
          }]
        })
      }

      if (result?.found && result.queryId) {
        // Cache gefunden: Setze Daten und stoppe alle weiteren Processing-Steps
        // Priorisiere storyTopicsData über answer
        if (result.storyTopicsData) {
          setCachedStoryTopicsData(result.storyTopicsData)
          // Setze auch cachedTOC für Rückwärtskompatibilität (inkl. Parameter)
          setCachedTOC({
            answer: result.answer || '',
            references: result.references,
            suggestedQuestions: result.suggestedQuestions,
            queryId: result.queryId,
            createdAt: result.createdAt || new Date().toISOString(),
            answerLength: result.answerLength,
            retriever: result.retriever,
            targetLanguage: result.targetLanguage,
            character: result.character,
            socialContext: result.socialContext,
            facetsSelected: result.facetsSelected,
          })
        } else if (result.answer) {
          // Fallback: Normale Antwort (für alte Caches)
          setCachedTOC({
            answer: result.answer,
            references: result.references,
            suggestedQuestions: result.suggestedQuestions,
            queryId: result.queryId,
            createdAt: result.createdAt || new Date().toISOString(),
            answerLength: result.answerLength,
            retriever: result.retriever,
            targetLanguage: result.targetLanguage,
            character: result.character,
            socialContext: result.socialContext,
            facetsSelected: result.facetsSelected,
          })
          setCachedStoryTopicsData(null)
        } else {
          setCachedTOC(null)
          setCachedStoryTopicsData(null)
        }
        
        // WICHTIG: Entferne alle Processing-Steps außer Cache-Check-Steps, wenn Cache gefunden wurde
        // Dies verhindert, dass weitere Schritte angezeigt werden
        if (setProcessingSteps) {
          setProcessingSteps(prev => {
            // Behalte nur Cache-Check-Steps
            return prev.filter(s => s.type === 'cache_check' || s.type === 'cache_check_complete')
          })
        }
        
        // WICHTIG: Setze shouldAutoGenerateRef auf false, damit keine automatische Generierung gestartet wird
        // Dies wird durch die useEffect-Bedingung in chat-panel.tsx überprüft, aber wir setzen es hier
        // explizit, um Race Conditions zu vermeiden
      } else {
        // KEIN Cache gefunden
        setCachedTOC(null)
        setCachedStoryTopicsData(null)
        // WICHTIG: Entferne alle Processing-Steps außer Cache-Check-Steps
        // Die automatische Generierung wird dann durch chat-panel.tsx gestartet
        if (setProcessingSteps) {
          setProcessingSteps(prev => {
            // Behalte nur Cache-Check-Steps, damit die Generierung dann neue Steps hinzufügen kann
            return prev.filter(s => s.type === 'cache_check' || s.type === 'cache_check_complete')
          })
        }
      }
    } catch (error) {
      console.error('[useChatTOC] Fehler beim Cache-Check:', error)
      // Bei Fehler: Setze Cache auf null, keine automatische Generierung
      setCachedTOC(null)
      setCachedStoryTopicsData(null)
      
      // Füge Fehler-Step hinzu
      if (setProcessingSteps) {
        setProcessingSteps(prev => {
          const filtered = prev.filter(s => s.type !== 'cache_check' && s.type !== 'cache_check_complete')
          const cacheCheckStep = prev.find(s => s.type === 'cache_check')
          const newSteps = cacheCheckStep ? [cacheCheckStep] : []
          return [...filtered, ...newSteps, {
            type: 'cache_check_complete',
            found: false,
            queryId: undefined,
          }]
        })
      }
    } finally {
      // Reset Check-Flag NACH der Generierungs-Entscheidung
      // WICHTIG: Warte kurz, damit die Processing-Steps angezeigt werden können
      setTimeout(() => {
        isCheckingTOCRef.current = false
        setIsCheckingTOC(false)
      }, 100)
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
  }, [isSending, isCheckingTOC, cachedStoryTopicsData, cachedTOC, sendQuestion])

  // Erzwingt Neugenerierung des TOC, auch wenn bereits ein Cache vorhanden ist
  const forceRegenerateTOC = useCallback(async () => {
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
  }, [isSending, isCheckingTOC, sendQuestion])


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
      character?: string
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

