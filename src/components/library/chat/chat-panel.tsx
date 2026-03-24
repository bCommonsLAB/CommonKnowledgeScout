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
  type LlmModelId,
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
import { getInitialTargetLanguage, getInitialCharacter, getInitialAccessPerspective, getInitialSocialContext, getInitialGenderInclusive, getInitialLlmModel } from './utils/chat-storage'
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
  
  // Helper-Funktionen für localStorage-Persistierung von activeChatId
  const getStoredActiveChatId = useCallback((libId: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem(`chat-activeChatId-${libId}`)
      return stored || null
    } catch {
      return null
    }
  }, [])
  
  const saveActiveChatId = useCallback((libId: string, chatId: string | null) => {
    if (typeof window === 'undefined') return
    try {
      if (chatId) {
        localStorage.setItem(`chat-activeChatId-${libId}`, chatId)
      } else {
        localStorage.removeItem(`chat-activeChatId-${libId}`)
      }
    } catch {
      // Ignoriere Fehler beim Speichern
    }
  }, [])
  
  // Initialisiere activeChatId aus localStorage
  const [activeChatId, setActiveChatIdState] = useState<string | null>(() => {
    return libraryId ? getStoredActiveChatId(libraryId) : null
  })
  
  // Wrapper für setActiveChatId, der auch in localStorage speichert
  const setActiveChatId = useCallback((chatId: string | null) => {
    setActiveChatIdState(chatId)
    if (libraryId) {
      saveActiveChatId(libraryId, chatId)
    }
  }, [libraryId, saveActiveChatId])
  
  // Lade activeChatId aus localStorage, wenn libraryId sich ändert
  useEffect(() => {
    if (libraryId) {
      const stored = getStoredActiveChatId(libraryId)
      if (stored !== activeChatId) {
        // Verwende setActiveChatIdState direkt, um Endlosschleife zu vermeiden
        // (setActiveChatId würde auch speichern, was hier nicht nötig ist, da wir bereits aus localStorage laden)
        setActiveChatIdState(stored)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, getStoredActiveChatId]) // activeChatId nicht als Dependency, um Endlosschleife zu vermeiden
  
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
  const [llmModelState] = useState<LlmModelId>(getInitialLlmModel())
  
  const targetLanguage = isEmbedded ? storyContext.targetLanguage : targetLanguageState
  const character = isEmbedded ? storyContext.character : characterState
  const accessPerspective = isEmbedded ? storyContext.accessPerspective : accessPerspectiveState
  const socialContext = isEmbedded ? storyContext.socialContext : socialContextState
  const llmModel = (isEmbedded ? storyContext.llmModel : llmModelState) || ''
  const setTargetLanguage = isEmbedded ? storyContext.setTargetLanguage : setTargetLanguageState
  
  console.log('[ChatPanel] llmModel bestimmt:', {
    isEmbedded,
    llmModel,
    storyContextLlmModel: storyContext.llmModel,
    llmModelState,
    hasLlmModel: !!llmModel,
  })
  
  // Log targetLanguage-Quelle für Debugging
  useEffect(() => {
    console.log('[ChatPanel] targetLanguage bestimmt:', {
      isEmbedded,
      targetLanguage,
      storyContextTargetLanguage: storyContext.targetLanguage,
      targetLanguageState,
      source: isEmbedded ? 'storyContext' : 'localState',
    })
  }, [isEmbedded, targetLanguage, storyContext.targetLanguage, targetLanguageState])
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
  
  // Detail View Type aus Library Config (direkt aus Atom, wie in gallery-root.tsx)
  const libraries = useAtomValue(librariesAtom)
  const activeLibrary = libraries.find(lib => lib.id === libraryId)
  const galleryConfig = activeLibrary?.config?.chat?.gallery
  // Alle gültigen DetailViewTypes akzeptieren
  const validDetailViewTypes = ['book', 'session', 'climateAction', 'testimonial', 'blog', 'divaDocument'] as const
  const rawDetailViewType = galleryConfig?.detailViewType
  const detailViewType = validDetailViewTypes.includes(rawDetailViewType as typeof validDetailViewTypes[number]) 
    ? rawDetailViewType 
    : 'book'
  const typeKey = detailViewType === 'session' ? 'talks' : 'documents'
  
  // Chat History
  const { messages, setMessages, prevMessagesLengthRef } = useChatHistory({
    libraryId,
    activeChatId,
  })
  
  // activeChatId-Änderungen werden still vom History-Hook verarbeitet.
  
  // Open Conversations State
  const [openConversations, setOpenConversations] = useState<Set<string>>(new Set())
  
  // Ref zum Verfolgen, ob die Historie bereits initial geladen wurde
  // Dies verhindert, dass Conversations wieder geöffnet werden, wenn der Benutzer sie geschlossen hat
  const historyInitializedRef = useRef<string | null>(null)
  
  // Öffne automatisch alle Conversations beim ersten Laden der Historie
  // Dies stellt sicher, dass wiederhergestellte Fragen auf- und zuklappbar sind
  useEffect(() => {
    // Nur ausführen, wenn activeChatId vorhanden ist und sich geändert hat
    if (activeChatId && historyInitializedRef.current !== activeChatId && messages.length > 0) {
      // Markiere diesen Chat als initialisiert
      historyInitializedRef.current = activeChatId
      
      // VARIANTE 2 BEHOBEN: Verwende exakt die gleiche Logik wie groupMessagesToConversations
      // Stelle sicher, dass conversationId konsistent ist
      const conversations: string[] = []
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i]
        if (msg.type === 'question' && msg.queryId) {
          // Verwende EXAKT die gleiche Logik wie in groupMessagesToConversations
          // Dies stellt sicher, dass die IDs konsistent sind
          const conversationId = msg.queryId 
            ? `${msg.queryId}-${msg.id}` 
            : msg.id.replace('-question', '') || `conv-${i}`
          conversations.push(conversationId)
        }
      }
      
      // Öffne alle Conversations beim ersten Laden
      // Der Benutzer kann sie danach normal schließen
      if (conversations.length > 0) {
        setOpenConversations(new Set(conversations))
      }
    }
  }, [messages, activeChatId])
  
  // Setze historyInitializedRef zurück, wenn activeChatId sich ändert oder null wird
  useEffect(() => {
    if (!activeChatId) {
      historyInitializedRef.current = null
    }
  }, [activeChatId])
  
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
        // Extrahiere Cache-Felder aus cacheParams, falls vorhanden (neue Einträge), sonst Root-Felder (alte Einträge)
        const queryParams = {
          targetLanguage: queryLog.cacheParams?.targetLanguage ?? queryLog.targetLanguage,
          character: queryLog.cacheParams?.character ?? queryLog.character,
          socialContext: queryLog.cacheParams?.socialContext ?? queryLog.socialContext,
          facetsSelected: queryLog.cacheParams?.facetsSelected ?? queryLog.facetsSelected ?? {},
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
        
        // Debug-Logging: Prüfe, ob storyTopicsData vorhanden ist
        console.log('[chat-panel] Complete-Step empfangen:', {
          hasStoryTopicsData: !!completeStep.storyTopicsData,
          storyTopicsDataKeys: completeStep.storyTopicsData ? Object.keys(completeStep.storyTopicsData) : [],
          storyTopicsDataTitle: completeStep.storyTopicsData?.title,
          storyTopicsDataTopicsCount: completeStep.storyTopicsData?.topics?.length,
        })
        
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
        
        console.log('[chat-panel] TOC-Query-Prüfung:', {
          isTOCQueryInMessages,
          isTOCQueryInSteps,
          hasStoryTopicsData: !!completeStep.storyTopicsData,
          isTOCQuery,
        })
        
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
            accessPerspective,
            socialContext,
            facetsSelected: galleryFilters || {},
            llmModel,
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
        } catch {
          // Wenn Parsing fehlschlägt, verwende Status-Text
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
              {isEmbedded && (
                <>
                  {/* StoryTopics nur anzeigen, wenn Dokumente vorhanden sind */}
                  {filteredDocsCount >= 1 && !galleryDataLoading && (
                    <StoryTopics 
                      libraryId={libraryId}
                      data={cachedStoryTopicsData}
                      isLoading={isCheckingTOC}
                      queryId={cachedTOC?.queryId}
                      cachedTOC={cachedTOC}
                      showReloadButton={showReloadButton}
                      processingSteps={processingSteps}
                      docCount={filteredDocsCount}
                      docType={typeKey}
                      answerLength={answerLength}
                      retriever={retriever}
                      targetLanguage={targetLanguage}
                      character={character}
                      accessPerspective={accessPerspective}
                      socialContext={socialContext}
                      filters={galleryFilters || {}}
                      llmModel={llmModel}
                      onSelectQuestion={(question) => {
                        setInput(question.text)
                        setIsChatInputOpen(true)
                        setTimeout(() => {
                          inputRef.current?.focus()
                        }, 100)
                      }}
                    />
                  )}
                  {/* Logge Render-Entscheidung */}
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
            {isEmbedded && (
              <>
                {/* StoryTopics nur anzeigen, wenn Dokumente vorhanden sind */}
                {filteredDocsCount >= 1 && !galleryDataLoading && (
                  <StoryTopics 
                    libraryId={libraryId}
                    data={cachedStoryTopicsData}
                    isLoading={isCheckingTOC}
                    queryId={cachedTOC?.queryId}
                    cachedTOC={cachedTOC}
                    showReloadButton={showReloadButton}
                    onRegenerate={forceRegenerateTOC}
                    isRegenerating={isGeneratingTOC}
                    processingSteps={processingSteps}
                    docCount={filteredDocsCount}
                    docType={typeKey}
                    answerLength={answerLength}
                    retriever={retriever}
                    targetLanguage={targetLanguage}
                    character={character}
                    accessPerspective={accessPerspective}
                    socialContext={socialContext}
                    filters={galleryFilters || {}}
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

