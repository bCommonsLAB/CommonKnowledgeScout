"use client"

import { useEffect, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StoryTopics } from '../story/story-topics'
import type { ChatResponse } from '@/types/chat-response'
import { useSetAtom } from 'jotai'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import {
  type Character,
  type AnswerLength,
  type Retriever,
  type TargetLanguage,
  type SocialContext,
  ANSWER_LENGTH_DEFAULT,
  RETRIEVER_DEFAULT,
  TOC_QUESTION,
} from '@/lib/chat/constants'
import { useStoryContext } from '@/hooks/use-story-context'
import { storyPerspectiveOpenAtom } from '@/atoms/story-context-atom'
import { useUser } from '@clerk/nextjs'
import { ChatInput } from './chat-input'
import { ChatConfigBar } from './chat-config-bar'
import { ChatConfigPopover } from './chat-config-popover'
import { ChatMessagesList } from './chat-messages-list'
import { useChatScroll } from './hooks/use-chat-scroll'
import { getInitialTargetLanguage, getInitialCharacter, getInitialSocialContext, getInitialGenderInclusive } from './utils/chat-storage'
import { useLibraryConfig } from '@/hooks/use-library-config'
import { useAnonymousPreferences } from '@/hooks/use-anonymous-preferences'
import { useSessionHeaders } from '@/hooks/use-session-headers'
import { useChatHistory } from './hooks/use-chat-history'
import { useChatStream } from './hooks/use-chat-stream'
import { useChatTOC } from './hooks/use-chat-toc'
import type { QueryLog } from '@/types/query-log'
import type { GalleryFilters } from '@/atoms/gallery-filters'

interface ChatPanelProps {
  libraryId: string
  variant?: 'default' | 'compact' | 'embedded'
}

export function ChatPanel({ libraryId, variant = 'default' }: ChatPanelProps) {
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
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const [retriever, setRetriever] = useState<Retriever>(RETRIEVER_DEFAULT)
  const [isChatInputOpen, setIsChatInputOpen] = useState(false)
  
  // Context State (embedded vs. local)
  const [targetLanguageState, setTargetLanguageState] = useState<TargetLanguage>(getInitialTargetLanguage())
  const [characterState, setCharacterState] = useState<Character>(getInitialCharacter())
  const [socialContextState, setSocialContextState] = useState<SocialContext>(getInitialSocialContext())
  const [genderInclusive, setGenderInclusive] = useState<boolean>(getInitialGenderInclusive())
  
  const targetLanguage = isEmbedded ? storyContext.targetLanguage : targetLanguageState
  const character = isEmbedded ? storyContext.character : characterState
  const socialContext = isEmbedded ? storyContext.socialContext : socialContextState
  const setTargetLanguage = isEmbedded ? storyContext.setTargetLanguage : setTargetLanguageState
  const setCharacter = isEmbedded ? storyContext.setCharacter : setCharacterState
  const setSocialContext = isEmbedded ? storyContext.setSocialContext : setSocialContextState
  
  // Anonymous Preferences
  const { save: saveAnonymousPreferences } = useAnonymousPreferences()
  
  // Session Headers
  const sessionHeaders = useSessionHeaders()
  
  // Handler für Config-Popover: Speichere Werte beim Schließen
  function handleConfigPopoverChange(open: boolean) {
    setConfigPopoverOpen(open)
    
    if (!open && !isEmbedded && isAnonymous) {
      saveAnonymousPreferences({
        targetLanguage: targetLanguageState,
        character: characterState,
        socialContext: socialContextState,
        genderInclusive,
      })
    }
  }
  
  // Gallery Filters
  const galleryFilters = useAtomValue(galleryFiltersAtom)
  
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
          cache: 'no-store'
        })
        
        if (!queryRes.ok || cancelled) return
        
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
  }, [cachedTOC?.queryId, libraryId, targetLanguage, character, socialContext, galleryFilters])
  
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
            character,
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
    if (!cfg) return
    if (!isEmbedded) return // Nur im Story-Mode (embedded)
    if (perspectiveOpen) return // Im embedded-Modus: Nur wenn Popover geschlossen
    if (isSending) return // Wenn bereits eine Query läuft, überspringe Check
    
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
    hasCheckedCacheRef.current = true
    shouldAutoGenerateRef.current = true // Markiere für automatische Generierung, falls kein Cache
    checkTOCCache()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, isEmbedded, perspectiveOpen, isSending, galleryFilters, targetLanguage, character, socialContext, genderInclusive, messages])
  
  // Automatische Generierung beim ersten Laden ODER wenn kein Cache gefunden wurde
  // WICHTIG: Warte, bis der Cache-Check abgeschlossen ist (isCheckingTOC === false)
  useEffect(() => {
    if (!isEmbedded) return
    if (isSending || isCheckingTOC || isGeneratingTOC) return // Warte, bis Cache-Check abgeschlossen ist
    if (cachedStoryTopicsData || cachedTOC) {
      // Cache gefunden, keine Generierung nötig
      shouldAutoGenerateRef.current = false
      return
    }
    if (!sendQuestion) return
    
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
  }, [cachedStoryTopicsData, cachedTOC, isCheckingTOC, isEmbedded, sendQuestion, isSending, isGeneratingTOC, processingSteps])
  
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
      // Erster Cache-Check beim Laden
      hasCheckedCacheRef.current = true
      shouldAutoGenerateRef.current = true // Markiere für automatische Generierung, falls kein Cache
      checkTOCCache()
    }
    
    prevSendQuestionRef.current = sendQuestion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendQuestion, cfg, isEmbedded, perspectiveOpen, cachedStoryTopicsData, cachedTOC, checkTOCCache])
  
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
    config: { character?: Character; answerLength?: AnswerLength; retriever?: Retriever; targetLanguage?: TargetLanguage; socialContext?: SocialContext }
  ): Promise<void> {
    if (config.character) setCharacter(config.character)
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
    character: Character
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
      setCharacter(settings.character)
      setSocialContext(settings.socialContext)
      setGenderInclusive(settings.genderInclusive)
    } catch (error) {
      console.error('[ChatPanel] Fehler beim Speichern der Präferenzen:', error)
      setTargetLanguage(settings.targetLanguage)
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
  
  if (loading) return <div className={variant === 'compact' ? '' : 'p-6'}>Lade Chat...</div>
  if (error) return <div className={(variant === 'compact' ? '' : 'p-6 ') + 'text-destructive'}>{error}</div>
  if (!cfg) return <div className={variant === 'compact' ? '' : 'p-6'}>Keine Konfiguration gefunden.</div>
  
  if (variant === 'compact') {
    return (
      <div className="flex flex-col h-full min-h-0 w-full">
        {!isEmbedded && (
          <ChatConfigBar
            targetLanguage={targetLanguage}
            setTargetLanguage={setTargetLanguage}
            character={character}
            setCharacter={setCharacter}
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
        
        <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${isEmbedded ? 'relative' : ''}`}>
          <ScrollArea className="flex-1 min-h-0 h-full" ref={scrollRef}>
            <div className={`p-4 ${isEmbedded ? 'pb-56' : ''}`}>
              {isEmbedded && (
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
          
          {!isEmbedded && (
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
          )}
          
          {isEmbedded && (
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
          )}
        </div>
      </div>
    )
  }
  
  return (
    <div className="w-full h-full flex flex-col min-h-[600px] overflow-hidden">
      {!isEmbedded && (
        <ChatConfigBar
          targetLanguage={targetLanguage}
          setTargetLanguage={setTargetLanguage}
          character={character}
          setCharacter={setCharacter}
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
      
      <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${isEmbedded ? 'relative' : ''}`}>
        <ScrollArea className="flex-1 h-full" ref={scrollRef}>
          <div className={`p-6 ${isEmbedded ? 'pb-56' : ''}`}>
            {isEmbedded && (
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
        
        {!isEmbedded && (
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
        )}
        
        {isEmbedded && (
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

