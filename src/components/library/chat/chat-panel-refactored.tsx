"use client"

import { useEffect, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StoryTopics } from '../story/story-topics'
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
  const {
    isSending,
    processingSteps,
    sendQuestion,
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
      // Cache wird von useChatTOC geprüft - prüfe nach kurzer Verzögerung
      setTimeout(() => {
        checkTOCCache()
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
    generateTOC,
    checkCache: checkTOCCache,
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
  })
  
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const prevPerspectiveOpenRef = useRef<boolean | undefined>(undefined)
  
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
  
  // Prüfe Cache bei Änderungen der Kontext-Parameter oder Filter
  useEffect(() => {
    if (!cfg) return
    if (isEmbedded && perspectiveOpen) return // Im embedded-Modus: Nur wenn Popover geschlossen
    
    checkTOCCache()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, targetLanguage, character, socialContext, genderInclusive, libraryId, galleryFilters, perspectiveOpen])
  
  // Zusätzlicher useEffect für embedded-Modus: Reagiere auf Schließen des Popovers
  useEffect(() => {
    if (!isEmbedded || !cfg) {
      prevPerspectiveOpenRef.current = perspectiveOpen
      return
    }
    const wasOpen = prevPerspectiveOpenRef.current === true
    const isNowClosed = perspectiveOpen === false
    if (wasOpen && isNowClosed) {
      checkTOCCache()
    }
    prevPerspectiveOpenRef.current = perspectiveOpen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perspectiveOpen, isEmbedded, cfg])
  
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
      
      const tocQuestion = 'Welche Themen werden hier behandelt, können wir die übersichtlich als Inhaltsverzeichnis ausgeben.'
      const wasTOCQuery = messages.some(msg => msg.queryId === queryId && msg.type === 'question' && msg.content.trim() === tocQuestion.trim())
      
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
  
  async function onSend() {
    if (!cfg) return
    if (!input.trim()) return
    await sendQuestion(input.trim())
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
            <div className={`p-4 ${isEmbedded ? '' : ''}`}>
              {isEmbedded && (
                <div className="mb-6 pb-6 border-b">
                  <StoryTopics 
                    libraryId={libraryId}
                    data={cachedStoryTopicsData}
                    isLoading={isCheckingTOC}
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
          <div className={`p-6 ${isEmbedded ? '' : ''}`}>
            {isEmbedded && (
              <div className="mb-6 pb-6 border-b">
                <StoryTopics 
                  libraryId={libraryId}
                  data={cachedStoryTopicsData}
                  isLoading={isCheckingTOC}
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

