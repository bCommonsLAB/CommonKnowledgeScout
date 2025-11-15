"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { librariesAtom } from '@/atoms/library-atom'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StoryTopics } from '../story/story-topics'
import type { ChatResponse } from '@/types/chat-response'
import { useSetAtom } from 'jotai'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
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
import { useStoryContext } from '@/hooks/use-story-context'
import { storyPerspectiveOpenAtom } from '@/atoms/story-context-atom'
import { useUser } from '@clerk/nextjs'
import { ChatInput } from './chat-input'
import { Button } from '@/components/ui/button'
import { MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatConfigBar } from './chat-config-bar'
import { ChatConfigPopover } from './chat-config-popover'
import { ChatMessagesList } from './chat-messages-list'
import { useChatScroll } from './hooks/use-chat-scroll'
import { getInitialTargetLanguage, getInitialCharacter, getInitialAccessPerspective, getInitialSocialContext, getInitialGenderInclusive } from './utils/chat-storage'
import { useLibraryConfig } from '@/hooks/use-library-config'
import { useAnonymousPreferences } from '@/hooks/use-anonymous-preferences'
import { useSessionHeaders } from '@/hooks/use-session-headers'
import { useChatHistory } from './hooks/use-chat-history'
import { useChatStream } from './hooks/use-chat-stream'
import { useChatTOC } from './hooks/use-chat-toc'
import type { QueryLog } from '@/types/query-log'
import type { GalleryFilters } from '@/atoms/gallery-filters'
import { useTranslation } from '@/lib/i18n/hooks'
import { useGalleryData } from '@/hooks/gallery/use-gallery-data'

interface ChatPanelProps {
  libraryId: string
  variant?: 'default' | 'compact' | 'embedded'
}

export function ChatPanel({ libraryId, variant = 'default' }: ChatPanelProps) {
  const { t } = useTranslation()
  const isEmbedded = variant === 'embedded'
  const storyContext = useStoryContext()
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
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [answerLength, setAnswerLength] = useState<AnswerLength>(ANSWER_LENGTH_DEFAULT)
  const setChatReferencesAtom = useSetAtom(chatReferencesAtom)
  
  // Wrapper für setChatReferences, um die Signatur anzupassen
  const setChatReferences = useCallback((refs: { references: ChatResponse['references']; queryId?: string }) => {
    setChatReferencesAtom(refs)
  }, [setChatReferencesAtom])
  const [retriever, setRetriever] = useState<Retriever>(RETRIEVER_DEFAULT)
  const [isChatInputOpen, setIsChatInputOpen] = useState(false)
  
  // Context State (embedded vs. local)
  const [targetLanguageState, setTargetLanguageState] = useState<TargetLanguage>(getInitialTargetLanguage())
  const [characterState, setCharacterState] = useState<Character[]>(getInitialCharacter())
  const [accessPerspectiveState, setAccessPerspectiveState] = useState<AccessPerspective[]>(getInitialAccessPerspective())
  const [socialContextState, setSocialContextState] = useState<SocialContext>(getInitialSocialContext())
  const [genderInclusive, setGenderInclusive] = useState<boolean>(getInitialGenderInclusive())
  
  const targetLanguage = isEmbedded ? storyContext.targetLanguage : targetLanguageState
  const character = isEmbedded ? storyContext.character : characterState
  const accessPerspective = isEmbedded ? storyContext.accessPerspective : accessPerspectiveState
  const socialContext = isEmbedded ? storyContext.socialContext : socialContextState
  const setTargetLanguage = isEmbedded ? storyContext.setTargetLanguage : setTargetLanguageState
  // Wrapper für setCharacter: storyContext verwendet bereits Character[]
  const setCharacter = isEmbedded 
    ? storyContext.setCharacter
    : setCharacterState
  const setAccessPerspective = isEmbedded
    ? storyContext.setAccessPerspective
    : setAccessPerspectiveState
  const setSocialContext = isEmbedded ? storyContext.setSocialContext : setSocialContextState
  
  // Anonymous Preferences
  const { save: saveAnonymousPreferences } = useAnonymousPreferences()
  
  // Session Headers
  const sessionHeaders = useSessionHeaders()
  
  // Handler für Config-Popover: Speichere Werte beim Schließen
  function handleConfigPopoverChange(open: boolean) {
    setConfigPopoverOpen(open)
    
    if (!open && !isEmbedded && isAnonymous) {
      // Konvertiere Character-Array zu komma-separiertem String für localStorage
      const characterString = characterArrayToString(characterState)
      const accessPerspectiveString = accessPerspectiveArrayToString(accessPerspectiveState)
      
      saveAnonymousPreferences({
        targetLanguage: targetLanguageState,
        character: characterString,
        accessPerspective: accessPerspectiveString,
        socialContext: socialContextState,
        genderInclusive,
      })
    }
  }
  
  // Gallery Filters
  const galleryFilters = useAtomValue(galleryFiltersAtom)
  
  // Gallery Data für gefilterte Dokumente-Anzahl
  const { filteredDocs, loading: galleryDataLoading } = useGalleryData(galleryFilters || {}, 'story', '', libraryId)
  const filteredDocsCount = filteredDocs.length
  
  // Logge Dokumente-Lade-Status
  useEffect(() => {
    console.log('[ChatPanel] Gallery Data Status:', {
      filteredDocsCount,
      galleryDataLoading,
      hasDocs: filteredDocs.length > 0,
      docsLoaded: !galleryDataLoading && filteredDocs.length > 0,
    })
  }, [filteredDocsCount, galleryDataLoading, filteredDocs.length])
  
  // Detail View Type aus Library Config (direkt aus Atom, wie in gallery-root.tsx)
  const libraries = useAtomValue(librariesAtom)
  const activeLibrary = libraries.find(lib => lib.id === libraryId)
  const galleryConfig = activeLibrary?.config?.chat?.gallery
  const detailViewType = galleryConfig?.detailViewType === 'session' ? 'session' : 'book'
  const typeKey = detailViewType === 'session' ? 'talks' : 'documents'
  
  // Chat History
  const { messages, setMessages, prevMessagesLengthRef } = useChatHistory({
    libraryId,
    activeChatId,
  })
  
  // Open Conversations State
  const [openConversations, setOpenConversations] = useState<Set<string>>(new Set())
  
  // Chat Stream (muss vor useChatTOC sein, da sendQuestion benötigt wird)
  const checkTOCCacheRef = useRef<(() => Promise<void>) | null>(null)
  
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
    galleryFilters,
    setMessages,
    setActiveChatId,
    setOpenConversations,
    setChatReferences,
    onTOCComplete: async () => {
      // Wird von useChatTOC behandelt - prüfe Cache nach kurzer Verzögerung
      setTimeout(() => {
        if (checkTOCCacheRef.current) {
          checkTOCCacheRef.current()
        }
      }, 1000)
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
  
  // Setze Ref für späteren Zugriff
  checkTOCCacheRef.current = checkTOCCache
  
  // State für Reload-Button-Anzeige (wenn Parameter geändert wurden)
  const [showReloadButton, setShowReloadButton] = useState(false)
  
  // Parameter-Vergleich: Prüfe, ob aktuelle Parameter von Query-Parametern abweichen
  useEffect(() => {
    if (!cachedTOC?.queryId || !libraryId) {
      setShowReloadButton(false)
      return
    }
    
    let cancelled = false
    
    async function compareParams() {
      if (!cachedTOC?.queryId) {
        return
      }
      
      try {
        const queryRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(cachedTOC.queryId)}`, {
          cache: 'no-store',
          headers: Object.keys(sessionHeaders).length > 0 ? sessionHeaders : undefined,
        })
        
        if (!queryRes.ok || cancelled) {
          // Wenn Query nicht gefunden wurde (404), setze showReloadButton auf false
          // und beende die Funktion, ohne Fehler zu werfen
          if (queryRes.status === 404) {
            setShowReloadButton(false)
            return
          }
          return
        }
        
        const queryLog = await queryRes.json() as QueryLog
        
        if (cancelled) return
        
        // Vergleiche Parameter
        const queryParams = {
          targetLanguage: queryLog.targetLanguage,
          character: queryLog.character,
          socialContext: queryLog.socialContext,
          facetsSelected: queryLog.facetsSelected || {},
        }
        
        const currentParams = {
          targetLanguage,
          character,
          socialContext,
          facetsSelected: galleryFilters || {},
        }
        
        // Normalisiere Filter für Vergleich
        const normalizeFilters = (filters: GalleryFilters | Record<string, unknown>): Record<string, string[]> => {
          const normalized: Record<string, string[]> = {}
          Object.entries(filters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              normalized[key] = value.map(v => String(v)).sort()
            } else if (value !== undefined && value !== null) {
              normalized[key] = [String(value)].sort()
            }
          })
          return normalized
        }
        
        const queryFiltersNormalized = normalizeFilters(queryParams.facetsSelected)
        const currentFiltersNormalized = normalizeFilters(currentParams.facetsSelected)
        
        // Vergleiche alle Parameter
        const paramsMatch = 
          queryParams.targetLanguage === currentParams.targetLanguage &&
          queryParams.character === currentParams.character &&
          queryParams.socialContext === currentParams.socialContext &&
          JSON.stringify(queryFiltersNormalized) === JSON.stringify(currentFiltersNormalized)
        
        setShowReloadButton(!paramsMatch)
      } catch (error) {
        console.error('[ChatPanel] Fehler beim Vergleich der Parameter:', error)
        setShowReloadButton(false)
      }
    }
    
    compareParams()
    
    return () => {
      cancelled = true
    }
  }, [cachedTOC?.queryId, libraryId, targetLanguage, character, socialContext, galleryFilters, sessionHeaders])
  
  // Setze TOC-Daten direkt, wenn sie aus dem Stream kommen
  useEffect(() => {
    if (processingSteps.length > 0) {
      const lastStep = processingSteps[processingSteps.length - 1]
      if (lastStep.type === 'complete') {
        const completeStep = lastStep as import('@/types/chat-processing').ChatProcessingStep & {
          storyTopicsData?: import('@/types/story-topics').StoryTopicsData
        }
        // Prüfe, ob dies eine TOC-Query war
        // WICHTIG: Prüfe sowohl messages als auch processingSteps, da die Message möglicherweise
        // noch nicht in messages ist, wenn der complete-Step kommt
        const isTOCQueryInMessages = messages.some(
          (msg) => msg.type === 'question' && msg.content.trim() === TOC_QUESTION.trim()
        )
        // Prüfe auch processingSteps für TOC-Query-Indikator
        const isTOCQueryInSteps = processingSteps.some(
          (step) => step.type === 'retriever_selected' && 
            (step as { retriever?: string; reason?: string }).reason?.includes('TOC query')
        )
        const isTOCQuery = isTOCQueryInMessages || isTOCQueryInSteps || !!completeStep.storyTopicsData
        
        // Für TOC-Queries: Rufe IMMER setTOCData auf, auch wenn storyTopicsData null ist
        // (um isGeneratingTOCRef zurückzusetzen und Endlosschleifen zu verhindern)
        if (isTOCQuery) {
          setTOCData({
            storyTopicsData: completeStep.storyTopicsData,
            answer: lastStep.answer || '',
            references: Array.isArray(lastStep.references)
              ? lastStep.references.filter(
                  (r): r is ChatResponse['references'][number] =>
                    typeof r === 'object' &&
                    r !== null &&
                    'number' in r &&
                    'fileId' in r &&
                    'description' in r
                )
              : [],
            suggestedQuestions: Array.isArray(lastStep.suggestedQuestions)
              ? lastStep.suggestedQuestions.filter((q: unknown): q is string => typeof q === 'string')
              : [],
            queryId: typeof lastStep.queryId === 'string' ? lastStep.queryId : `temp-${Date.now()}`,
            // Parameter aus aktuellem State speichern
            answerLength,
            retriever,
            targetLanguage,
            // character ist bereits Array (kann leer sein)
            character: character,
            socialContext,
            facetsSelected: galleryFilters || {},
          })
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingSteps.length, processingSteps])
  
  
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
  })
  
  // Prüfe Cache beim ersten Laden UND bei Filter-/Parameteränderungen
  // WICHTIG: Nur im Story-Mode (embedded) und nur wenn keine normale Frage läuft
  const hasCheckedCacheRef = useRef(false)
  const shouldAutoGenerateRef = useRef(false)
  const lastFiltersRef = useRef<string>('')
  const lastParamsRef = useRef<string>('')
  
  useEffect(() => {
    if (!cfg) {
      console.log('[ChatPanel] useEffect #1 (parameter-change): Übersprungen - cfg nicht vorhanden')
      return
    }
    if (!isEmbedded) {
      console.log('[ChatPanel] useEffect #1 (parameter-change): Übersprungen - nicht im embedded Modus')
      return // Nur im Story-Mode (embedded)
    }
    if (perspectiveOpen) {
      console.log('[ChatPanel] useEffect #1 (parameter-change): Übersprungen - Popover ist geöffnet')
      return // Im embedded-Modus: Nur wenn Popover geschlossen
    }
    if (isSending) {
      console.log('[ChatPanel] useEffect #1 (parameter-change): Übersprungen - Query läuft bereits')
      return // Wenn bereits eine Query läuft, überspringe Check
    }
    
    // WICHTIG: Prüfe, ob der Benutzer gerade eine normale Frage gestellt hat
    // Der Cache-Check sollte nur für TOC-Queries durchgeführt werden, nicht für normale Fragen
    const hasNormalQuestions = messages.some(
      (msg) => msg.type === 'question' && msg.content.trim() !== TOC_QUESTION.trim()
    )
    if (hasNormalQuestions) {
      console.log('[ChatPanel] useEffect #1 (parameter-change): Übersprungen - normale Fragen vorhanden')
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
    })
    
    // Prüfe, ob sich Filter oder Parameter geändert haben
    const filtersChanged = lastFiltersRef.current !== currentFiltersKey
    const paramsChanged = lastParamsRef.current !== currentParamsKey
    
    // Wenn sich Filter oder Parameter geändert haben, setze hasCheckedCacheRef zurück
    if (filtersChanged || paramsChanged) {
      console.log('[ChatPanel] useEffect #1 (parameter-change): Parameter geändert, setze hasCheckedCacheRef zurück', {
        filtersChanged,
        paramsChanged,
      })
      hasCheckedCacheRef.current = false
      lastFiltersRef.current = currentFiltersKey
      lastParamsRef.current = currentParamsKey
    }
    
    // Wenn bereits geprüft wurde und sich nichts geändert hat, überspringe
    if (hasCheckedCacheRef.current && !filtersChanged && !paramsChanged) {
      console.log('[ChatPanel] useEffect #1 (parameter-change): Übersprungen - bereits geprüft, keine Änderungen')
      return
    }
    
    // Cache-Check durchführen (nur für TOC, nicht für normale Fragen)
    // WICHTIG: Prüfe auch, ob Dokumente geladen sind (mindestens 1)
    if (filteredDocsCount < 1 || galleryDataLoading) {
      console.log('[ChatPanel] useEffect #1 (parameter-change): Cache-Check übersprungen - Dokumente noch nicht geladen', {
        filteredDocsCount,
        galleryDataLoading,
      })
      return
    }
    
    console.log('[ChatPanel] useEffect #1 (parameter-change): Starte Cache-Check', {
      targetLanguage,
      character,
      socialContext,
      genderInclusive,
      filtersChanged,
      paramsChanged,
      hasCheckedCacheRef: hasCheckedCacheRef.current,
      filteredDocsCount,
      galleryDataLoading,
    })
    hasCheckedCacheRef.current = true
    shouldAutoGenerateRef.current = true // Markiere für automatische Generierung, falls kein Cache
    checkTOCCache()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, isEmbedded, perspectiveOpen, isSending, galleryFilters, targetLanguage, character, socialContext, genderInclusive, messages, filteredDocsCount, galleryDataLoading])
  
  // Automatische Generierung beim ersten Laden ODER wenn kein Cache gefunden wurde
  // WICHTIG: Warte, bis der Cache-Check abgeschlossen ist (isCheckingTOC === false)
  useEffect(() => {
    if (!isEmbedded) {
      console.log('[ChatPanel] useEffect #2 (auto-generate): Übersprungen - nicht im embedded Modus')
      return
    }
    if (isSending || isCheckingTOC || isGeneratingTOC) {
      console.log('[ChatPanel] useEffect #2 (auto-generate): Übersprungen - Prozess läuft bereits', {
        isSending,
        isCheckingTOC,
        isGeneratingTOC,
      })
      return // Warte, bis Cache-Check abgeschlossen ist
    }
    if (cachedStoryTopicsData || cachedTOC) {
      console.log('[ChatPanel] useEffect #2 (auto-generate): Übersprungen - Cache bereits vorhanden', {
        hasStoryTopicsData: !!cachedStoryTopicsData,
        hasCachedTOC: !!cachedTOC,
      })
      // Cache gefunden, keine Generierung nötig
      shouldAutoGenerateRef.current = false
      return
    }
    if (!sendQuestion) {
      console.log('[ChatPanel] useEffect #2 (auto-generate): Übersprungen - sendQuestion nicht verfügbar')
      return
    }
    // WICHTIG: Prüfe auch, ob Dokumente geladen sind (mindestens 1)
    if (filteredDocsCount < 1 || galleryDataLoading) {
      console.log('[ChatPanel] useEffect #2 (auto-generate): Übersprungen - Dokumente noch nicht geladen', {
        filteredDocsCount,
        galleryDataLoading,
      })
      return
    }
    
    // Prüfe, ob ein Cache-Check durchgeführt wurde (durch Vorhandensein von Cache-Check-Steps)
    const hasCacheCheckSteps = processingSteps.some(s => s.type === 'cache_check' || s.type === 'cache_check_complete')
    const cacheCheckComplete = processingSteps.some(s => s.type === 'cache_check_complete')
    
    // Nur automatisch generieren, wenn:
    // 1. shouldAutoGenerateRef gesetzt ist (beim ersten Laden) ODER
    // 2. Cache-Check abgeschlossen wurde und kein Cache gefunden wurde
    if (!shouldAutoGenerateRef.current && (!hasCacheCheckSteps || !cacheCheckComplete)) {
      console.log('[ChatPanel] useEffect #2 (auto-generate): Übersprungen - Cache-Check noch nicht abgeschlossen', {
        shouldAutoGenerateRef: shouldAutoGenerateRef.current,
        hasCacheCheckSteps,
        cacheCheckComplete,
      })
      return // Kein Cache-Check durchgeführt oder noch nicht abgeschlossen
    }
    
    // Cache-Check abgeschlossen und kein Cache gefunden → Starte Generierung
    console.log('[ChatPanel] useEffect #2 (auto-generate): Starte automatische TOC-Generierung', {
      shouldAutoGenerateRef: shouldAutoGenerateRef.current,
      hasCacheCheckSteps,
      cacheCheckComplete,
      filteredDocsCount,
      galleryDataLoading,
    })
    // WICHTIG: Warte zusätzlich 300ms, damit die Cache-Check-Steps angezeigt werden können
    shouldAutoGenerateRef.current = false
    setTimeout(() => {
      // Prüfe nochmal, ob in der Zwischenzeit ein Cache gefunden wurde
      if (cachedStoryTopicsData || cachedTOC) {
        console.log('[ChatPanel] useEffect #2 (auto-generate): Generierung abgebrochen - Cache wurde in der Zwischenzeit gefunden')
        return // Cache wurde in der Zwischenzeit gefunden, keine Generierung
      }
      console.log('[ChatPanel] useEffect #2 (auto-generate): Rufe generateTOC() auf')
      generateTOC()
    }, 300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedStoryTopicsData, cachedTOC, isCheckingTOC, isEmbedded, sendQuestion, isSending, isGeneratingTOC, processingSteps, filteredDocsCount, galleryDataLoading])
  
  // Zusätzlicher useEffect: Wenn sendQuestion verfügbar wird und noch kein Cache-Check durchgeführt wurde
  // WICHTIG: Nur beim ersten Laden, wenn sendQuestion verfügbar wird
  const prevSendQuestionRef = useRef<typeof sendQuestion>(undefined)
  useEffect(() => {
    if (!cfg || !isEmbedded) {
      prevSendQuestionRef.current = sendQuestion
      return
    }
    if (perspectiveOpen) {
      console.log('[ChatPanel] useEffect #3 (sendQuestion-available): Übersprungen - Popover ist geöffnet')
      prevSendQuestionRef.current = sendQuestion
      return // Nur wenn Popover geschlossen
    }
    if (cachedStoryTopicsData || cachedTOC) {
      console.log('[ChatPanel] useEffect #3 (sendQuestion-available): Übersprungen - TOC bereits vorhanden')
      prevSendQuestionRef.current = sendQuestion
      return // TOC bereits vorhanden
    }
    if (hasCheckedCacheRef.current) {
      console.log('[ChatPanel] useEffect #3 (sendQuestion-available): Übersprungen - Cache-Check bereits durchgeführt')
      prevSendQuestionRef.current = sendQuestion
      return // Cache-Check bereits durchgeführt
    }
    
    // Nur beim ersten Laden, wenn sendQuestion von undefined zu definiert gewechselt ist
    const wasUndefined = prevSendQuestionRef.current === undefined
    const isNowDefined = sendQuestion !== undefined
    if (wasUndefined && isNowDefined) {
      // WICHTIG: Prüfe auch, ob Dokumente geladen sind (mindestens 1)
      if (filteredDocsCount < 1 || galleryDataLoading) {
        console.log('[ChatPanel] useEffect #3 (sendQuestion-available): Cache-Check übersprungen - Dokumente noch nicht geladen', {
          filteredDocsCount,
          galleryDataLoading,
        })
        prevSendQuestionRef.current = sendQuestion
        return
      }
      
      console.log('[ChatPanel] useEffect #3 (sendQuestion-available): sendQuestion wurde verfügbar, starte ersten Cache-Check', {
        filteredDocsCount,
        galleryDataLoading,
      })
      // Erster Cache-Check beim Laden
      hasCheckedCacheRef.current = true
      shouldAutoGenerateRef.current = true // Markiere für automatische Generierung, falls kein Cache
      checkTOCCache()
    } else {
      console.log('[ChatPanel] useEffect #3 (sendQuestion-available): Übersprungen - sendQuestion nicht von undefined zu definiert gewechselt', {
        wasUndefined,
        isNowDefined,
      })
    }
    
    prevSendQuestionRef.current = sendQuestion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendQuestion, cfg, isEmbedded, perspectiveOpen, cachedStoryTopicsData, cachedTOC, checkTOCCache, filteredDocsCount, galleryDataLoading])
  
  // Handler für das Löschen einer Query
  async function handleDeleteQuery(queryId: string): Promise<void> {
    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`, {
        method: 'DELETE',
        headers: Object.keys(sessionHeaders).length > 0 ? sessionHeaders : undefined,
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
        const errorMessage = typeof errorData?.error === 'string' ? errorData.error : 'Fehler beim Löschen der Query'
        throw new Error(errorMessage)
      }
      
      const wasTOCQuery = messages.some(msg => msg.queryId === queryId && msg.type === 'question' && msg.content.trim() === TOC_QUESTION.trim())
      
      setMessages(prev => prev.filter(msg => msg.queryId !== queryId))
      
      if (wasTOCQuery) {
        setTimeout(() => {
          checkTOCCache()
        }, 500)
      }
    } catch (error) {
      console.error('[ChatPanel] Fehler beim Löschen der Query:', error)
      throw error
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
            setMessages={setMessages}
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
              {isEmbedded && (
                <>
                  {/* Hinweis immer anzeigen, wenn Dokumente geladen sind (>= 1) */}
                  {filteredDocsCount >= 1 && !galleryDataLoading && (
                    <div className="mb-4 text-sm text-muted-foreground">
                      {t('chatMessages.topicsOverviewIntro', {
                        count: filteredDocsCount,
                        type: t(`gallery.${typeKey}`),
                      })}
                    </div>
                  )}
                  {/* StoryTopics nur anzeigen, wenn Dokumente vorhanden sind */}
                  {filteredDocsCount >= 1 && !galleryDataLoading && (
                    <div className="mb-6 pb-6 border-b">
                      <StoryTopics 
                    libraryId={libraryId}
                    data={cachedStoryTopicsData}
                    isLoading={isCheckingTOC}
                    queryId={cachedTOC?.queryId}
                    cachedTOC={cachedTOC}
                    showReloadButton={showReloadButton}
                    onSelectQuestion={(question) => {
                      setInput(question.text)
                      setIsChatInputOpen(true)
                      setTimeout(() => {
                        inputRef.current?.focus()
                      }, 100)
                    }}
                      />
                    </div>
                  )}
                  {/* Logge Render-Entscheidung */}
                  {isEmbedded && (() => {
                    const shouldShowIntro = (cachedStoryTopicsData || cachedTOC || isCheckingTOC) && filteredDocsCount >= 1 && !galleryDataLoading
                    const shouldShowTopics = filteredDocsCount >= 1 && !galleryDataLoading
                    console.log('[ChatPanel] Render-Entscheidung Themenübersicht:', {
                      shouldShowIntro,
                      shouldShowTopics,
                      filteredDocsCount,
                      galleryDataLoading,
                      hasCachedStoryTopicsData: !!cachedStoryTopicsData,
                      hasCachedTOC: !!cachedTOC,
                      isCheckingTOC,
                    })
                    return null
                  })()}
                </>
              )}
              
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
                socialContext={socialContext}
                onQuestionClick={(question) => {
                  setInput(question)
                  inputRef.current?.focus()
                }}
                onDelete={handleDeleteQuery}
                onReload={handleReloadQuestion}
                messageRefs={messageRefs}
                isEmbedded={isEmbedded}
                isCheckingTOC={isCheckingTOC}
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
          setMessages={setMessages}
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
            {isEmbedded && (
              <>
                {/* Hinweis immer anzeigen, wenn Dokumente geladen sind (>= 1) */}
                {filteredDocsCount >= 1 && !galleryDataLoading && (
                  <div className="mb-4 text-sm text-muted-foreground">
                    {t('chatMessages.topicsOverviewIntro', {
                      count: filteredDocsCount,
                      type: t(`gallery.${typeKey}`),
                    })}
                  </div>
                )}
                {/* StoryTopics nur anzeigen, wenn Dokumente vorhanden sind */}
                {filteredDocsCount >= 1 && !galleryDataLoading && (
                  <div className="mb-6 pb-6 border-b">
                    <StoryTopics 
                  libraryId={libraryId}
                  data={cachedStoryTopicsData}
                  isLoading={isCheckingTOC}
                  queryId={cachedTOC?.queryId}
                  cachedTOC={cachedTOC}
                  showReloadButton={showReloadButton}
                  onRegenerate={forceRegenerateTOC}
                  isRegenerating={isGeneratingTOC}
                  onSelectQuestion={(question) => {
                    setInput(question.text)
                    setIsChatInputOpen(true)
                    setTimeout(() => {
                      inputRef.current?.focus()
                    }, 200)
                  }}
                    />
                  </div>
                )}
                {/* Logge Render-Entscheidung */}
                {isEmbedded && (() => {
                  const shouldShowIntro = (cachedStoryTopicsData || cachedTOC || isCheckingTOC) && filteredDocsCount >= 1 && !galleryDataLoading
                  const shouldShowTopics = filteredDocsCount >= 1 && !galleryDataLoading
                  console.log('[ChatPanel] Render-Entscheidung Themenübersicht (default variant):', {
                    shouldShowIntro,
                    shouldShowTopics,
                    filteredDocsCount,
                    galleryDataLoading,
                    hasCachedStoryTopicsData: !!cachedStoryTopicsData,
                    hasCachedTOC: !!cachedTOC,
                    isCheckingTOC,
                  })
                  return null
                })()}
              </>
            )}
            
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
              socialContext={socialContext}
              filters={galleryFilters}
              onQuestionClick={(question) => {
                setInput(question)
                setIsChatInputOpen(true)
                setTimeout(() => {
                  inputRef.current?.focus()
                }, 100)
              }}
              onDelete={handleDeleteQuery}
              onReload={handleReloadQuestion}
              messageRefs={messageRefs}
              isEmbedded={isEmbedded}
              isCheckingTOC={isCheckingTOC}
              cachedTOC={cachedTOC}
              cachedStoryTopicsData={cachedStoryTopicsData}
            />
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

