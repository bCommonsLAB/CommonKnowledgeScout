"use client"

/**
 * ChatPanel — der Chat der Voll-App (Reiter „Chat") und, eingebettet, die
 * Mitte des Story-Modus.
 *
 * Seit D6 (Plan `story-dreiteilung-fragenchronik`) nur noch Zustand,
 * Verdrahtung und Layout. Was hier nicht mehr liegt (`chat-panel/`):
 * - Perspektive (Story-Context oder lokal): `hooks/use-chat-perspective-state`
 * - Konversationen beim Laden aufklappen: `hooks/use-open-conversations-on-load`
 * - Bruecke zu Chronik und Auswahl (D1/D2): `hooks/use-story-auswahl-bridge`
 * - Themenuebersicht: Nachladen-Hinweis, Abschluss-Schritt, Autostart,
 *   Filter-Ereignisse: `hooks/use-toc-reload-hint`, `use-toc-complete-step`,
 *   `use-story-toc-autostart`, `use-story-filter-events`
 * - Aktionen (loeschen, neu stellen, Praeferenzen, senden): `hooks/use-chat-actions`
 */

import { useCallback, useRef, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useUser } from '@clerk/nextjs'
import { ScrollArea, Button } from '@ks/ui'
import { MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@ks/i18n/react'
import { chatReferencesAtom, galleryFiltersAtom, useGalleryData } from '@ks/module-explorer/react'
import { STORY_UEBERSICHT } from '@ks/module-story/react'
import type { ChatResponse } from '@/types/chat-response'
import {
  type AnswerLength,
  type Retriever,
  ANSWER_LENGTH_DEFAULT,
  RETRIEVER_DEFAULT,
  characterArrayToString,
  accessPerspectiveArrayToString,
} from '@/lib/chat/constants'
import { storyPerspectiveOpenAtom } from '@/atoms/story-context-atom'
import { useLibraryConfig } from '@/hooks/use-library-config'
import { useAnonymousPreferences } from '@/hooks/use-anonymous-preferences'
import { useClerkSessionHeaders } from '@/hooks/use-clerk-session-headers'
import { StoryMitte } from '../story/story-mitte'
import { ChatInput } from './chat-input'
import { ChatConfigBar } from './chat-config-bar'
import { ChatConfigPopover } from './chat-config-popover'
import { ChatMessagesList } from './chat-messages-list'
import { useChatHistory } from './hooks/use-chat-history'
import { useChatScroll } from './hooks/use-chat-scroll'
import { useChatStream } from './hooks/use-chat-stream'
import { useChatTOC } from './hooks/use-chat-toc'
import type { UseChatTOCResult } from './hooks/use-chat-toc/types'
import { frageZurAuswahl } from './utils/chronik-utils'
import { useActiveChatId } from './chat-panel/hooks/use-active-chat-id'
import { useChatActions } from './chat-panel/hooks/use-chat-actions'
import { useChatPerspectiveState } from './chat-panel/hooks/use-chat-perspective-state'
import { useOpenConversationsOnLoad } from './chat-panel/hooks/use-open-conversations-on-load'
import { useStoryAuswahlBridge } from './chat-panel/hooks/use-story-auswahl-bridge'
import { useStoryFilterEvents } from './chat-panel/hooks/use-story-filter-events'
import { useStoryTocAutostart } from './chat-panel/hooks/use-story-toc-autostart'
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

  const { cfg, loading, error: configError } = useLibraryConfig(libraryId)
  const [error, setError] = useState<string | null>(configError)
  const [input, setInput] = useState('')
  const { activeChatId, setActiveChatId } = useActiveChatId(libraryId)
  const [answerLength, setAnswerLength] = useState<AnswerLength>(ANSWER_LENGTH_DEFAULT)
  const [retriever, setRetriever] = useState<Retriever>(RETRIEVER_DEFAULT)
  const [isChatInputOpen, setIsChatInputOpen] = useState(false)
  const setChatReferencesAtom = useSetAtom(chatReferencesAtom)
  const setChatReferences = useCallback(
    (refs: { references: ChatResponse['references']; queryId?: string }) => setChatReferencesAtom(refs),
    [setChatReferencesAtom],
  )

  const perspektive = useChatPerspectiveState(isEmbedded)
  const { targetLanguage, character, accessPerspective, socialContext, llmModel, genderInclusive } = perspektive
  const { save: saveAnonymousPreferences } = useAnonymousPreferences()
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

  // Galerie: Filter und gefilterte Dokumentenzahl (eingebettet aus dem Atom, sonst selbst geladen).
  const galleryFilters = useAtomValue(galleryFiltersAtom)
  const galleryData = useGalleryData(galleryFilters || {}, 'story', '', libraryId, { skipApiCall: isEmbedded })
  const filteredDocsCount = galleryData.totalCount || 0
  const galleryDataLoading = galleryData.loading

  const { messages, setMessages, prevMessagesLengthRef } = useChatHistory({ libraryId, activeChatId })
  const [openConversations, setOpenConversations] = useState<Set<string>>(new Set())
  useOpenConversationsOnLoad({ messages, activeChatId, setOpenConversations })

  // Stream vor TOC (sendQuestion), TOC-Setter per Ref in den Stream-Rueckruf.
  const setTOCDataRef = useRef<UseChatTOCResult['setTOCData'] | null>(null)
  const { isSending, processingSteps, sendQuestion, setProcessingSteps } = useChatStream({
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
      setTOCDataRef.current?.({
        storyTopicsData: data.storyTopicsData,
        answer: data.answer,
        references: data.references,
        suggestedQuestions: data.suggestedQuestions,
        queryId: data.queryId,
        answerLength,
        retriever,
        targetLanguage,
        character,
        accessPerspective,
        socialContext,
        facetsSelected: galleryFilters || {},
        llmModel,
      })
    },
    onError: (err) => setError(err),
  })

  const {
    cachedStoryTopicsData,
    cachedTOC,
    isCheckingTOC,
    isGeneratingTOC,
    generateTOC,
    forceRegenerateTOC,
    checkCache: checkTOCCache,
    setTOCData,
  } = useChatTOC({ libraryId, cfg, targetLanguage, character, socialContext, genderInclusive, galleryFilters, isEmbedded, isSending, sendQuestion, setProcessingSteps })
  setTOCDataRef.current = setTOCData

  const { storyAuswahl, setStoryAuswahl, konversation, gewaehlteKonversation } = useStoryAuswahlBridge({
    isEmbedded,
    messages,
    setMessages,
    activeChatId,
    isSending,
    gliederung: cachedStoryTopicsData ?? null,
    setOpenConversations,
  })

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

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  useChatScroll({ scrollRef, messages, openConversations, setOpenConversations, isSending, processingSteps, prevMessagesLengthRef, gewaehlteKonversation })

  const autostartRefs = useStoryTocAutostart({
    cfg,
    isEmbedded,
    perspectiveOpen,
    isSending,
    isCheckingTOC,
    isGeneratingTOC,
    messages,
    galleryFilters,
    targetLanguage,
    character,
    socialContext,
    genderInclusive,
    llmModel,
    filteredDocsCount,
    galleryDataLoading,
    cachedStoryTopicsData,
    cachedTOC,
    sendQuestion,
    processingSteps,
    checkTOCCache,
    generateTOC,
  })
  useStoryFilterEvents({ isEmbedded, isSending, isGeneratingTOC, galleryFilters, cachedStoryTopicsData, cachedTOC, checkTOCCache, forceRegenerateTOC, refs: autostartRefs })

  const { handleDeleteQuery, handleReloadQuestion, saveUserPreferences, onSend } = useChatActions({
    libraryId,
    cfg,
    sessionHeaders,
    input,
    setInput,
    messages,
    setMessages,
    checkTOCCache,
    sendQuestion,
    setCharacter: perspektive.setCharacter,
    setAnswerLength,
    setRetriever,
    setTargetLanguage: perspektive.setTargetLanguage,
    setSocialContext: perspektive.setSocialContext,
    setGenderInclusive: perspektive.setGenderInclusive,
  })

  const { setTargetLanguage, setCharacter, setAccessPerspective, setSocialContext, setGenderInclusive } = perspektive

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

