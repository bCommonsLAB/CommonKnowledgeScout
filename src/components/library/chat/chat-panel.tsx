"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@ks/module-explorer/react'
import { ScrollArea, Button } from '@ks/ui'
import { StoryMitte } from '../story/story-mitte'
import { STORY_UEBERSICHT } from '@ks/module-story/react'
import { frageZurAuswahl } from './utils/chronik-utils'
import type { ChatResponse } from '@/types/chat-response'
import { useSetAtom } from 'jotai'
import { chatReferencesAtom } from '@ks/module-explorer/react'
import {
  type Character,
  type AccessPerspective,
  type AnswerLength,
  type Retriever,
  type TargetLanguage,
  type SocialContext,
  ANSWER_LENGTH_DEFAULT,
  RETRIEVER_DEFAULT,
  TOC_QUESTION,
  characterArrayToString,
  accessPerspectiveArrayToString,
} from '@/lib/chat/constants'
import { storyPerspectiveOpenAtom } from '@/atoms/story-context-atom'
import { useUser } from '@clerk/nextjs'
import { ChatInput } from './chat-input'
import { MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatConfigBar } from './chat-config-bar'
import { ChatConfigPopover } from './chat-config-popover'
import { ChatMessagesList } from './chat-messages-list'
import { useChatScroll } from './hooks/use-chat-scroll'
import { useLibraryConfig } from '@/hooks/use-library-config'
import { useAnonymousPreferences } from '@/hooks/use-anonymous-preferences'
import { useClerkSessionHeaders } from '@/hooks/use-clerk-session-headers'
import { useChatHistory } from './hooks/use-chat-history'
import { useChatStream } from './hooks/use-chat-stream'
import { useChatTOC } from './hooks/use-chat-toc'
import { useTranslation } from '@ks/i18n/react'
import { useGalleryData } from '@ks/module-explorer/react'
import { useActiveChatId } from './chat-panel/hooks/use-active-chat-id'
import { useChatPerspectiveState } from './chat-panel/hooks/use-chat-perspective-state'
import { useOpenConversationsOnLoad } from './chat-panel/hooks/use-open-conversations-on-load'
import { useStoryAuswahlBridge } from './chat-panel/hooks/use-story-auswahl-bridge'
import { useTocCompleteStep } from './chat-panel/hooks/use-toc-complete-step'
import { useTocReloadHint } from './chat-panel/hooks/use-toc-reload-hint'

interface ChatPanelProps {
  libraryId: string
  variant?: 'default' | 'compact' | 'embedded'
}

export function ChatPanel({ libraryId, variant = 'default' }: ChatPanelProps) {
  const { t } = useTranslation()
  const isEmbedded = variant === 'embedded'
  const { isSignedIn } = useUser()
  const isAnonymous = !isSignedIn
  const [configPopoverOpen, setConfigPopoverOpen] = useState(false)
  const storyPerspectiveOpen = useAtomValue(storyPerspectiveOpenAtom)
  const perspectiveOpen = isEmbedded ? storyPerspectiveOpen : configPopoverOpen
  
  // Library Config laden
  const { cfg, loading, error: configError } = useLibraryConfig(libraryId)
  const [error, setError] = useState<string | null>(configError)
  
  // Input State
  const [input, setInput] = useState('')
  
  // activeChatId mit localStorage-Persistenz (Welle 3-III-b: extrahiert in use-active-chat-id)
  const { activeChatId, setActiveChatId } = useActiveChatId(libraryId)
  
  const [answerLength, setAnswerLength] = useState<AnswerLength>(ANSWER_LENGTH_DEFAULT)
  const setChatReferencesAtom = useSetAtom(chatReferencesAtom)
  
  // Wrapper für setChatReferences, um die Signatur anzupassen
  const setChatReferences = useCallback((refs: { references: ChatResponse['references']; queryId?: string }) => {
    setChatReferencesAtom(refs)
  }, [setChatReferencesAtom])
  const [retriever, setRetriever] = useState<Retriever>(RETRIEVER_DEFAULT)
  const [isChatInputOpen, setIsChatInputOpen] = useState(false)
  
  // Perspektive (D6): eingebettet aus dem Story-Context, sonst lokal — hooks/use-chat-perspective-state
  const perspektive = useChatPerspectiveState(isEmbedded)
  const { targetLanguage, character, accessPerspective, socialContext, llmModel, genderInclusive, setGenderInclusive, setTargetLanguage, setCharacter, setAccessPerspective, setSocialContext } = perspektive

  // Anonymous Preferences
  const { save: saveAnonymousPreferences } = useAnonymousPreferences()

  // Session Headers
  const sessionHeaders = useClerkSessionHeaders()

  // Konfig-Popover: beim Schliessen die lokalen Werte fuer anonyme Betrachter sichern.
  function handleConfigPopoverChange(open: boolean) {
    setConfigPopoverOpen(open)
    if (!open && !isEmbedded && isAnonymous) {
      saveAnonymousPreferences({
        targetLanguage: perspektive.lokal.targetLanguage,
        character: characterArrayToString(perspektive.lokal.character),
        accessPerspective: accessPerspectiveArrayToString(perspektive.lokal.accessPerspective),
        socialContext: perspektive.lokal.socialContext,
        genderInclusive,
      })
    }
  }

  
  // Gallery Filters
  const galleryFilters = useAtomValue(galleryFiltersAtom)
  
  // Gallery Data für gefilterte Dokumente-Anzahl
  // Im eingebetteten Modus: Verwende Atom-Daten (wird von GalleryRoot aktualisiert), überspringe API-Aufruf
  // Im Standalone-Modus: Lade Daten selbst
  const galleryData = useGalleryData(
    galleryFilters || {}, 
    'story', 
    '', 
    libraryId,
    { skipApiCall: isEmbedded } // Im eingebetteten Modus keine API-Aufrufe
  )
  
  const filteredDocsCount = galleryData.totalCount || 0
  const galleryDataLoading = galleryData.loading
  
  // Dokumente-Lade-Status wird nur intern für Render-Entscheidungen verwendet.
  
  
  // Chat History
  const { messages, setMessages, prevMessagesLengthRef } = useChatHistory({
    libraryId,
    activeChatId,
  })
  
  // activeChatId-Änderungen werden still vom History-Hook verarbeitet.
  
  // Open Conversations State
  const [openConversations, setOpenConversations] = useState<Set<string>>(new Set())
  useOpenConversationsOnLoad({ messages, activeChatId, setOpenConversations })

  
  // Chat Stream (muss vor useChatTOC sein, da sendQuestion benötigt wird)
  const checkTOCCacheRef = useRef<(() => Promise<void>) | null>(null)
  const setTOCDataRef = useRef<((data: {
    storyTopicsData?: import('@/types/story-topics').StoryTopicsData
    answer: string
    references: import('@/types/chat-response').ChatResponse['references']
    suggestedQuestions: string[]
    queryId: string
    answerLength?: import('@/lib/chat/constants').AnswerLength
    retriever?: import('@/lib/chat/constants').Retriever
    targetLanguage?: import('@/lib/chat/constants').TargetLanguage
    character?: import('@/lib/chat/constants').Character[]
    accessPerspective?: import('@/lib/chat/constants').AccessPerspective[]
    socialContext?: import('@/lib/chat/constants').SocialContext
    facetsSelected?: Record<string, unknown>
    llmModel?: import('@/lib/chat/constants').LlmModelId
  }) => void) | null>(null)
  
  // Chat Stream
  const {
    isSending,
    processingSteps,
    sendQuestion,
    setProcessingSteps,
  } = useChatStream({
    libraryId,
    cfg,
    messages,
    activeChatId,
    retriever,
    answerLength,
    targetLanguage,
    character,
    accessPerspective,
    socialContext,
    genderInclusive,
    llmModel,
    galleryFilters,
    setMessages,
    setActiveChatId,
    setOpenConversations,
    setChatReferences,
    onTOCComplete: async (data) => {
      // Rufe setTOCData direkt auf, wenn verfügbar
      if (setTOCDataRef.current) {
        setTOCDataRef.current({
          storyTopicsData: data.storyTopicsData,
          answer: data.answer,
          references: data.references,
          suggestedQuestions: data.suggestedQuestions,
          queryId: data.queryId,
          // Parameter aus aktuellem State
          answerLength,
          retriever,
          targetLanguage,
          character,
          accessPerspective,
          socialContext,
          facetsSelected: galleryFilters || {},
          llmModel,
        })
      }
    },
    onError: (err) => {
      setError(err)
    },
  })
  
  // Chat TOC
  const {
    cachedStoryTopicsData,
    cachedTOC,
    isCheckingTOC,
    isGeneratingTOC,
    generateTOC,
    forceRegenerateTOC,
    checkCache: checkTOCCache,
    setTOCData,
  } = useChatTOC({
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
  })
  
  // Setze Refs für späteren Zugriff
  checkTOCCacheRef.current = checkTOCCache
  setTOCDataRef.current = setTOCData

  // Story-Dreiteilung (D1/D2): Bruecke zu Chronik und Auswahl — hooks/use-story-auswahl-bridge
  const { storyAuswahl, setStoryAuswahl, konversation, gewaehlteKonversation } = useStoryAuswahlBridge({
    isEmbedded,
    messages,
    setMessages,
    activeChatId,
    isSending,
    gliederung: cachedStoryTopicsData ?? null,
    setOpenConversations,
  })

  // Themenuebersicht: Nachladen-Hinweis und Abschluss-Schritt aus dem Stream
  const showReloadButton = useTocReloadHint({
    libraryId,
    cachedTOCQueryId: cachedTOC?.queryId,
    targetLanguage,
    character,
    socialContext,
    galleryFilters,
    sessionHeaders,
  })
  useTocCompleteStep({
    processingSteps,
    messages,
    setTOCData,
    params: { answerLength, retriever, targetLanguage, character, accessPerspective, socialContext, facetsSelected: galleryFilters || {}, llmModel },
  })

  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  
  // Auto-Scroll-Logik
  useChatScroll({
    scrollRef,
    messages,
    openConversations,
    setOpenConversations,
    isSending,
    processingSteps,
    prevMessagesLengthRef,
    gewaehlteKonversation,
  })
  
  // Prüfe Cache beim ersten Laden UND bei Filter-/Parameteränderungen
  // WICHTIG: Nur im Story-Mode (embedded) und nur wenn keine normale Frage läuft
  const hasCheckedCacheRef = useRef(false)
  const shouldAutoGenerateRef = useRef(false)
  const lastFiltersRef = useRef<string>('')
  const lastParamsRef = useRef<string>('')
  
  // Event-Listener für Filter-Reset im Story-Modus
  // Wenn Filter zurückgesetzt werden, soll das TOC neu berechnet werden
  useEffect(() => {
    const handleFiltersCleared = () => {
      // Nur im Story-Modus (embedded) reagieren
      if (!isEmbedded) {
        return
      }
      
      // Setze hasCheckedCacheRef zurück, damit Cache-Check erneut durchgeführt wird
      hasCheckedCacheRef.current = false
      
      // Lösche aktuellen Cache, damit neuer Cache gesetzt werden kann
      // (wird durch checkTOCCache automatisch neu geladen)
      
      // Starte Cache-Check mit neuen Filtern (leere Filter)
      // Der useEffect #1 wird automatisch reagieren, aber wir triggern explizit einen Check
      checkTOCCache()
    }
    
    window.addEventListener('gallery-filters-cleared', handleFiltersCleared)
    return () => {
      window.removeEventListener('gallery-filters-cleared', handleFiltersCleared)
    }
  }, [isEmbedded, checkTOCCache])
  
  // Event-Listener für Filter-Änderungen im Story-Modus
  // Wenn Filter gesetzt werden (z.B. beim Wechsel von Detail-Overlay zu Story-Mode),
  // soll das TOC neu berechnet werden
  useEffect(() => {
    const handleFiltersChanged = () => {
      // Nur im Story-Modus (embedded) reagieren
      if (!isEmbedded) {
        console.log('[ChatPanel] ⏭️ gallery-filters-changed Event ignoriert (nicht im embedded-Modus)')
        return
      }
      
      // Wenn bereits eine Query läuft, überspringe (verhindert Race Conditions)
      if (isSending || isGeneratingTOC) {
        console.log('[ChatPanel] ⏭️ gallery-filters-changed Event ignoriert (Query läuft bereits):', {
          isSending,
          isGeneratingTOC,
        })
        return
      }
      
      console.log('[ChatPanel] 🎯 gallery-filters-changed Event empfangen:', {
        isEmbedded,
        currentFilters: JSON.stringify(galleryFilters || {}),
        timestamp: new Date().toISOString(),
      })
      
      // Setze hasCheckedCacheRef zurück, damit Cache-Check erneut durchgeführt wird
      hasCheckedCacheRef.current = false
      
      // Setze auch lastFiltersRef zurück, damit Filter-Änderung erkannt wird
      // WICHTIG: Setze auf leeren String, damit der useEffect #1 die Änderung erkennt
      lastFiltersRef.current = ''
      
      // Setze shouldAutoGenerateRef, damit die TOC neu generiert wird
      shouldAutoGenerateRef.current = true
      
      console.log('[ChatPanel] ✅ Refs zurückgesetzt:', {
        hasCheckedCacheRef: hasCheckedCacheRef.current,
        lastFiltersRef: lastFiltersRef.current,
        shouldAutoGenerateRef: shouldAutoGenerateRef.current,
      })
      
      // WICHTIG: checkTOCCache() ist eine No-Op, daher müssen wir die TOC direkt neu generieren
      // Verwende forceRegenerateTOC(), um sicherzustellen, dass die TOC mit den neuen Filtern neu generiert wird
      // forceRegenerateTOC() löscht den Cache automatisch und generiert die TOC neu
      // Warte kurz, damit die Filter-Setzung abgeschlossen ist
      setTimeout(() => {
        // Prüfe nochmal, ob wir immer noch im Story-Mode sind und keine Query läuft
        if (!isSending && !isGeneratingTOC) {
          console.log('[ChatPanel] 🔄 Starte TOC-Neuberechnung nach Filter-Änderung (forceRegenerateTOC)')
          void forceRegenerateTOC()
        } else {
          console.log('[ChatPanel] ⏭️ Überspringe TOC-Neuberechnung (Query läuft bereits):', {
            isSending,
            isGeneratingTOC,
          })
        }
      }, 500)
    }
    
    window.addEventListener('gallery-filters-changed', handleFiltersChanged)
    return () => {
      window.removeEventListener('gallery-filters-changed', handleFiltersChanged)
    }
  }, [isEmbedded, galleryFilters, isSending, isGeneratingTOC, cachedStoryTopicsData, cachedTOC, forceRegenerateTOC])
  
  useEffect(() => {
    if (!cfg) {
      return
    }
    if (!isEmbedded) {
      return // Nur im Story-Mode (embedded)
    }
    if (perspectiveOpen) {
      return // Im embedded-Modus: Nur wenn Popover geschlossen
    }
    if (isSending) {
      return // Wenn bereits eine Query läuft, überspringe Check
    }
    
    // WICHTIG: Prüfe, ob der Benutzer gerade eine normale Frage gestellt hat
    // Der Cache-Check sollte nur für TOC-Queries durchgeführt werden, nicht für normale Fragen
    const hasNormalQuestions = messages.some(
      (msg) => msg.type === 'question' && msg.content.trim() !== TOC_QUESTION.trim()
    )
    if (hasNormalQuestions) {
      // Benutzer hat bereits normale Fragen gestellt, kein Cache-Check für TOC nötig
      return
    }
    
    // Erstelle Cache-Key aus aktuellen Parametern
    const currentFiltersKey = JSON.stringify(galleryFilters || {})
    const currentParamsKey = JSON.stringify({
      targetLanguage,
      character,
      socialContext,
      genderInclusive,
      llmModel,
    })
    
    // Prüfe, ob sich Filter oder Parameter geändert haben
    const filtersChanged = lastFiltersRef.current !== currentFiltersKey
    const paramsChanged = lastParamsRef.current !== currentParamsKey
    
    // Wenn sich Filter oder Parameter geändert haben, setze hasCheckedCacheRef zurück
    if (filtersChanged || paramsChanged) {
      hasCheckedCacheRef.current = false
      lastFiltersRef.current = currentFiltersKey
      lastParamsRef.current = currentParamsKey
    }
    
    // Wenn bereits geprüft wurde und sich nichts geändert hat, überspringe
    if (hasCheckedCacheRef.current && !filtersChanged && !paramsChanged) {
      return
    }
    
    // Cache-Check durchführen (nur für TOC, nicht für normale Fragen)
    // WICHTIG: Prüfe auch, ob Dokumente geladen sind (mindestens 1)
    if (filteredDocsCount < 1 || galleryDataLoading) {
      return
    }
    // WICHTIG: Ohne llmModel kein konsistenter Cache-Key → warte auf Initialisierung
    if (!llmModel) {
      return
    }
    hasCheckedCacheRef.current = true
    shouldAutoGenerateRef.current = true // Markiere für automatische Generierung, falls kein Cache
    checkTOCCache()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, isEmbedded, perspectiveOpen, isSending, galleryFilters, targetLanguage, character, socialContext, genderInclusive, llmModel, messages, filteredDocsCount, galleryDataLoading])
  
  // Automatische Generierung beim ersten Laden ODER wenn kein Cache gefunden wurde
  // WICHTIG: Warte, bis der Cache-Check abgeschlossen ist (isCheckingTOC === false)
  useEffect(() => {
    if (!isEmbedded) {
      return
    }
    if (isSending || isCheckingTOC || isGeneratingTOC) {
      return // Warte, bis Cache-Check abgeschlossen ist
    }
    if (cachedStoryTopicsData || cachedTOC) {
      // Cache gefunden, keine Generierung nötig
      shouldAutoGenerateRef.current = false
      return
    }
    if (!sendQuestion) {
      return
    }
    // WICHTIG: Ohne llmModel kein konsistenter Cache-Key → warte auf Initialisierung
    if (!llmModel) {
      return
    }
    // WICHTIG: Prüfe auch, ob Dokumente geladen sind (mindestens 1)
    if (filteredDocsCount < 1 || galleryDataLoading) {
      return
    }
    
    // Prüfe, ob ein Cache-Check durchgeführt wurde (durch Vorhandensein von Cache-Check-Steps)
    const hasCacheCheckSteps = processingSteps.some(s => s.type === 'cache_check' || s.type === 'cache_check_complete')
    const cacheCheckComplete = processingSteps.some(s => s.type === 'cache_check_complete')
    
    // Nur automatisch generieren, wenn:
    // 1. shouldAutoGenerateRef gesetzt ist (beim ersten Laden) ODER
    // 2. Cache-Check abgeschlossen wurde und kein Cache gefunden wurde
    if (!shouldAutoGenerateRef.current && (!hasCacheCheckSteps || !cacheCheckComplete)) {
      return // Kein Cache-Check durchgeführt oder noch nicht abgeschlossen
    }
    
    // Cache-Check abgeschlossen und kein Cache gefunden → Starte Generierung
    // WICHTIG: Warte zusätzlich 300ms, damit die Cache-Check-Steps angezeigt werden können
    shouldAutoGenerateRef.current = false
    setTimeout(() => {
      // Prüfe nochmal, ob in der Zwischenzeit ein Cache gefunden wurde
      if (cachedStoryTopicsData || cachedTOC) {
        return // Cache wurde in der Zwischenzeit gefunden, keine Generierung
      }
      generateTOC()
    }, 300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedStoryTopicsData, cachedTOC, isCheckingTOC, isEmbedded, sendQuestion, isSending, isGeneratingTOC, processingSteps, filteredDocsCount, galleryDataLoading, llmModel])
  
  // Zusätzlicher useEffect: Wenn sendQuestion verfügbar wird und noch kein Cache-Check durchgeführt wurde
  // WICHTIG: Nur beim ersten Laden, wenn sendQuestion verfügbar wird
  const prevSendQuestionRef = useRef<typeof sendQuestion>(undefined)
  useEffect(() => {
    if (!cfg || !isEmbedded) {
      prevSendQuestionRef.current = sendQuestion
      return
    }
    if (perspectiveOpen) {
      prevSendQuestionRef.current = sendQuestion
      return // Nur wenn Popover geschlossen
    }
    if (cachedStoryTopicsData || cachedTOC) {
      prevSendQuestionRef.current = sendQuestion
      return // TOC bereits vorhanden
    }
    if (hasCheckedCacheRef.current) {
      prevSendQuestionRef.current = sendQuestion
      return // Cache-Check bereits durchgeführt
    }
    
    // Nur beim ersten Laden, wenn sendQuestion von undefined zu definiert gewechselt ist
    const wasUndefined = prevSendQuestionRef.current === undefined
    const isNowDefined = sendQuestion !== undefined
    if (wasUndefined && isNowDefined) {
      // WICHTIG: Prüfe auch, ob Dokumente geladen sind (mindestens 1)
      if (filteredDocsCount < 1 || galleryDataLoading) {
        prevSendQuestionRef.current = sendQuestion
        return
      }
      
      // Erster Cache-Check beim Laden
      hasCheckedCacheRef.current = true
      shouldAutoGenerateRef.current = true // Markiere für automatische Generierung, falls kein Cache
      checkTOCCache()
    }
    
    prevSendQuestionRef.current = sendQuestion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendQuestion, cfg, isEmbedded, perspectiveOpen, cachedStoryTopicsData, cachedTOC, checkTOCCache, filteredDocsCount, galleryDataLoading])
  
  // Handler für das Löschen einer Query
  async function handleDeleteQuery(queryId: string): Promise<void> {
    try {
      const headers: Record<string, string> = {}
      
      // Füge Session-Headers hinzu, falls vorhanden
      if (Object.keys(sessionHeaders).length > 0) {
        Object.assign(headers, sessionHeaders)
      }
      
      
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`, {
        method: 'DELETE',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      })
      
      if (!res.ok) {
        // Versuche, Fehlerdetails aus der Response zu extrahieren
        let errorMessage = 'Fehler beim Löschen der Query'
        try {
          const contentType = res.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const errorData = await res.json()
            if (typeof errorData?.error === 'string') {
              errorMessage = errorData.error
            }
          } else {
            // Wenn keine JSON-Response, verwende Status-Text
            errorMessage = res.statusText || `HTTP ${res.status}`
          }
        } catch (parseError) {
          // JSON-Parsing der Fehlerantwort fehlgeschlagen — Status-Text als Fallback
          console.warn('[ChatPanel] Fehler beim Parsen der Error-Response:', parseError)
          errorMessage = res.statusText || `HTTP ${res.status}`
        }
        
        console.error('[ChatPanel] Fehler beim Löschen:', {
          status: res.status,
          statusText: res.statusText,
          errorMessage,
        })
        
        throw new Error(errorMessage)
      }
      
      const wasTOCQuery = messages.some(msg => msg.queryId === queryId && msg.type === 'question' && msg.content.trim() === TOC_QUESTION.trim())
      
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.queryId !== queryId)
        return filtered
      })
      
      if (wasTOCQuery) {
        setTimeout(() => {
          checkTOCCache()
        }, 500)
      }
    } catch (error) {
      console.error('[ChatPanel] Fehler beim Löschen der Query:', error)
      // Stelle sicher, dass immer ein Error-Objekt geworfen wird
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Unbekannter Fehler beim Löschen')
    }
  }
  
  // Handler für das Neustellen einer Frage
  async function handleReloadQuestion(
    question: string,
    config: { character?: Character[]; answerLength?: AnswerLength; retriever?: Retriever; targetLanguage?: TargetLanguage; socialContext?: SocialContext }
  ): Promise<void> {
    // Setze character direkt (bereits Array)
    if (config.character) {
      setCharacter(config.character)
    }
    if (config.answerLength) setAnswerLength(config.answerLength)
    if (config.retriever) setRetriever(config.retriever)
    if (config.targetLanguage) setTargetLanguage(config.targetLanguage)
    if (config.socialContext) setSocialContext(config.socialContext)
    
    setInput(question)
    
    await new Promise(resolve => setTimeout(resolve, 150))
    
    setTimeout(() => {
      if (input.trim()) {
        onSend()
      }
    }, 100)
  }
  
  // Speichere User-Präferenzen in Library-Config
  async function saveUserPreferences(settings: {
    targetLanguage: TargetLanguage
    character: Character[] // Array (kann leer sein)
    socialContext: SocialContext
    genderInclusive: boolean
  }): Promise<void> {
    try {
      const response = await fetch(`/api/libraries/${encodeURIComponent(libraryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: libraryId,
          config: {
            chat: {
              userPreferences: settings,
            },
          },
        }),
      }).catch(() => undefined)
      
      if (!response || !response.ok) {
        setTargetLanguage(settings.targetLanguage)
        setCharacter(settings.character)
        setSocialContext(settings.socialContext)
        setGenderInclusive(settings.genderInclusive)
        if (!response || response.status === 401 || response.status === 403) return
        throw new Error('Fehler beim Speichern der Präferenzen')
      }
      
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        setTargetLanguage(settings.targetLanguage)
        setCharacter(settings.character)
        setSocialContext(settings.socialContext)
        setGenderInclusive(settings.genderInclusive)
        return
      }
      
      setTargetLanguage(settings.targetLanguage)
      // character ist bereits ein Array (Character[])
      setCharacter(settings.character)
      setSocialContext(settings.socialContext)
      setGenderInclusive(settings.genderInclusive)
    } catch (error) {
      console.error('[ChatPanel] Fehler beim Speichern der Präferenzen:', error)
      setTargetLanguage(settings.targetLanguage)
      // character ist bereits ein Array (Character[])
      setCharacter(settings.character)
      setSocialContext(settings.socialContext)
      setGenderInclusive(settings.genderInclusive)
    }
  }
  
  async function onSend(asTOC?: boolean) {
    if (!cfg) return
    if (!input.trim()) return
    await sendQuestion(input.trim(), undefined, false, asTOC)
    setInput('')
  }
  
  // Gemeinsame ChatInput-Renderung für beide Varianten
  function renderChatInput() {
    if (!cfg) return null
    
    if (!isEmbedded) {
      return (
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={onSend}
          isSending={isSending}
          answerLength={answerLength}
          setAnswerLength={setAnswerLength}
          placeholder={cfg.config.placeholder}
          variant="default"
          inputRef={inputRef}
        />
      )
    }
    
    return (
      <ChatInput
        input={input}
        setInput={setInput}
        onSend={onSend}
        isSending={isSending}
        answerLength={answerLength}
        setAnswerLength={setAnswerLength}
        placeholder={cfg.config.placeholder}
        variant="embedded"
        inputRef={inputRef}
        isOpen={isChatInputOpen}
        onOpenChange={setIsChatInputOpen}
      />
    )
  }
  
  if (loading) return <div className={variant === 'compact' ? '' : 'p-6'}>Lade Chat...</div>
  if (error) return <div className={(variant === 'compact' ? '' : 'p-6 ') + 'text-destructive'}>{error}</div>
  if (!cfg) return <div className={variant === 'compact' ? '' : 'p-6'}>Keine Konfiguration gefunden.</div>
  
  if (variant === 'compact') {
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full" style={isEmbedded ? { maxHeight: '100%' } : undefined}>
        {!isEmbedded && (
          <ChatConfigBar
            targetLanguage={targetLanguage}
            setTargetLanguage={setTargetLanguage}
            character={character}
            setCharacter={setCharacter}
            accessPerspective={accessPerspective}
            setAccessPerspective={setAccessPerspective}
            socialContext={socialContext}
            setSocialContext={setSocialContext}
            libraryId={libraryId}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
            isEmbedded={isEmbedded}
          >
            <ChatConfigPopover
              open={configPopoverOpen}
              onOpenChange={handleConfigPopoverChange}
              answerLength={answerLength}
              setAnswerLength={setAnswerLength}
              retriever={retriever}
              setRetriever={setRetriever}
              genderInclusive={genderInclusive}
              setGenderInclusive={setGenderInclusive}
              targetLanguage={targetLanguage}
              character={character}
              socialContext={socialContext}
              onGenerateTOC={generateTOC}
              onSavePreferences={saveUserPreferences}
            />
          </ChatConfigBar>
        )}
        
        <div className={`flex-1 min-h-0 flex flex-col ${isEmbedded ? 'relative overflow-visible' : 'overflow-hidden'}`}>
          <ScrollArea className="flex-1 min-h-0 h-full" ref={scrollRef}>
            <div className={`p-4 ${isEmbedded ? 'pb-20' : ''}`}>
              {/* Variante compact ist nie eingebettet — der Story-Block (StoryTopics) war hier toter Code (D1). */}
              
              <ChatMessagesList
                messages={messages}
                openConversations={openConversations}
                setOpenConversations={setOpenConversations}
                libraryId={libraryId}
                isSending={isSending}
                processingSteps={processingSteps}
                error={error}
                answerLength={answerLength}
                retriever={retriever}
                targetLanguage={targetLanguage}
                character={character}
                accessPerspective={accessPerspective}
                socialContext={socialContext}
                llmModel={llmModel}
                onQuestionClick={(question) => {
                  setInput(question)
                  inputRef.current?.focus()
                }}
                onDelete={handleDeleteQuery}
                onReload={handleReloadQuestion}
                messageRefs={messageRefs}
                isEmbedded={isEmbedded}
                isCheckingTOC={isCheckingTOC}
                isGeneratingTOC={isGeneratingTOC}
                cachedTOC={cachedTOC}
              />
            </div>
          </ScrollArea>
          
          <div className="flex-shrink-0">
            {renderChatInput()}
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`w-full flex flex-col overflow-hidden flex-1 min-h-0`} style={isEmbedded ? { maxHeight: '100%' } : undefined}>
      {!isEmbedded && (
        <ChatConfigBar
          targetLanguage={targetLanguage}
          setTargetLanguage={setTargetLanguage}
          character={character}
          setCharacter={setCharacter}
          accessPerspective={accessPerspective}
          setAccessPerspective={setAccessPerspective}
          socialContext={socialContext}
          setSocialContext={setSocialContext}
          libraryId={libraryId}
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          isEmbedded={isEmbedded}
        >
          <ChatConfigPopover
            open={configPopoverOpen}
            onOpenChange={handleConfigPopoverChange}
            answerLength={answerLength}
            setAnswerLength={setAnswerLength}
            retriever={retriever}
            setRetriever={setRetriever}
            genderInclusive={genderInclusive}
            setGenderInclusive={setGenderInclusive}
            targetLanguage={targetLanguage}
            character={character}
            socialContext={socialContext}
            onGenerateTOC={generateTOC}
            onSavePreferences={saveUserPreferences}
          />
        </ChatConfigBar>
      )}
      
      <div className={`flex-1 min-h-0 flex flex-col ${isEmbedded ? 'relative overflow-visible' : 'overflow-hidden'}`}>
        <ScrollArea className="flex-1 h-full min-h-0" ref={scrollRef}>
          <div className={`p-6 ${isEmbedded ? 'pb-20' : ''}`}>
            {/* Mitte (D1): Kopf des Ganzen mit Themenkarten bzw. Themenseite,
                solange keine Konversation gewaehlt ist; nur mit Dokumenten. */}
            {isEmbedded && storyAuswahl.art !== 'konversation' && filteredDocsCount >= 1 && !galleryDataLoading && (
              <StoryMitte
                libraryId={libraryId}
                gliederung={cachedStoryTopicsData ?? null}
                auswahl={storyAuswahl}
                setAuswahl={setStoryAuswahl}
                dokumente={filteredDocsCount}
                isLoading={isCheckingTOC}
                isRegenerating={isGeneratingTOC}
                processingSteps={processingSteps}
                showReloadButton={showReloadButton}
                onRegenerate={forceRegenerateTOC}
                cachedTOC={cachedTOC}
                llmModel={llmModel}
                onSelectQuestion={(question) => {
                  setInput(question.text)
                  setIsChatInputOpen(true)
                  setTimeout(() => {
                    inputRef.current?.focus()
                  }, 200)
                }}
              />
            )}
            {isEmbedded && storyAuswahl.art !== 'konversation' && error && (
              <div className="mt-4 text-sm text-destructive p-3 bg-destructive/10 rounded border border-destructive/20">
                {error}
              </div>
            )}
            {isEmbedded && storyAuswahl.art === 'konversation' && konversation.length === 0 && !isSending && (
              <div className="text-sm text-muted-foreground p-4">
                {messages.length === 0 ? t('story.conversationLoading') : t('story.conversationNotInHistory')}
              </div>
            )}

            {(!isEmbedded || storyAuswahl.art === 'konversation') && (
            <ChatMessagesList
              messages={konversation}
              openConversations={openConversations}
              setOpenConversations={setOpenConversations}
              libraryId={libraryId}
              isSending={isSending}
              processingSteps={processingSteps}
              error={error}
              answerLength={answerLength}
              retriever={retriever}
              targetLanguage={targetLanguage}
              character={character}
              accessPerspective={accessPerspective}
              socialContext={socialContext}
              llmModel={llmModel}
              filters={galleryFilters}
              onQuestionClick={(question) => {
                setInput(question)
                setIsChatInputOpen(true)
                setTimeout(() => {
                  inputRef.current?.focus()
                }, 100)
              }}
              onDelete={async (queryId) => {
                const gewaehlt = frageZurAuswahl(messages, storyAuswahl)?.queryId
                await handleDeleteQuery(queryId)
                // Die gewaehlte Konversation ist weg → zurueck zur Uebersicht, nicht ins Leere.
                if (isEmbedded && gewaehlt === queryId) setStoryAuswahl(STORY_UEBERSICHT)
              }}
              onReload={handleReloadQuestion}
              messageRefs={messageRefs}
              isEmbedded={isEmbedded}
              isCheckingTOC={isCheckingTOC}
              isGeneratingTOC={isGeneratingTOC}
              cachedTOC={cachedTOC}
            />
            )}
            {/* Platzhalter: Hoehe setzt scrollElementToViewportTop (use-chat-scroll),
                damit die zuletzt gestellte Frage oben buendig stehen kann. */}
            <div data-chat-scroll-spacer aria-hidden="true" />
          </div>
        </ScrollArea>
        
        <div className="flex-shrink-0">
          {renderChatInput()}
        </div>
        
        {/* Chat-Symbol Button - direkt im Chat-Panel, relativ zum Chat-Panel-Container */}
        {isEmbedded && (
          <div
            style={{
              position: 'absolute',
              right: '1rem',
              bottom: '1rem',
              zIndex: 100,
            }}
          >
            <Button
              onClick={() => setIsChatInputOpen(!isChatInputOpen)}
              className={cn(
                "h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 shrink-0 p-0 aspect-square flex items-center justify-center",
                "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              aria-label={isChatInputOpen ? t('chat.input.closeChat') : t('chat.input.askQuestion')}
            >
              {isChatInputOpen ? (
                <X className="h-5 w-5 transition-transform duration-300" />
              ) : (
                <MessageCircle className="h-5 w-5 transition-transform duration-300" />
              )}
            </Button>
          </div>
        )}
        
        {cfg.config.footerText && !isEmbedded && (
          <div className="mt-4 text-xs text-muted-foreground px-4">
            {cfg.config.footerText} {cfg.config.companyLink ? (<a className="underline" href={cfg.config.companyLink} target="_blank" rel="noreferrer">mehr</a>) : null}
          </div>
        )}
      </div>
    </div>
  )
}

