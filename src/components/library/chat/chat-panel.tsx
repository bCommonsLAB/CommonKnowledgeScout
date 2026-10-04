"use client"

/**
 * ChatPanel — der Chat der Voll-App (Reiter „Chat").
 *
 * Seit D6c (Plan `story-dreiteilung-fragenchronik`) nur noch der Chat-Reiter:
 * Die Story-Mitte montiert `StoryRoot` aus `@ks/module-story`
 * (`story/story-root-mount.tsx`); die eingebettete Variante samt Bruecke zu
 * Chronik und Auswahl, Autostart der Themenuebersicht und Filter-Ereignissen
 * ist hier zurueckgebaut.
 *
 * Was hier nicht liegt (`chat-panel/`):
 * - Perspektive (lokal, localStorage-Startwerte): `hooks/use-chat-perspective-state`
 * - Konversationen beim Laden aufklappen: `hooks/use-open-conversations-on-load`
 * - Themenuebersicht uebernehmen: `hooks/use-toc-complete-step`
 * - Aktionen (loeschen, neu stellen, Praeferenzen, senden): `hooks/use-chat-actions`
 * - Kopf (Konfig-Leiste) und Fuss (Eingabe): `panel-header`, `panel-footer`
 *
 * Die Varianten `default` und `compact` teilen sich denselben Pfad
 * (compact: engerer Innenabstand, keine Fusszeile).
 */

import { useCallback, useRef, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useUser } from '@clerk/nextjs'
import { ScrollArea } from '@ks/ui'
import { chatReferencesAtom, galleryFiltersAtom } from '@ks/module-explorer/react'
import type { ChatResponse } from '@/types/chat-response'
import {
  type AnswerLength,
  type Retriever,
  ANSWER_LENGTH_DEFAULT,
  RETRIEVER_DEFAULT,
  characterArrayToString,
  accessPerspectiveArrayToString,
} from '@/lib/chat/constants'
import { useLibraryConfig } from '@/hooks/use-library-config'
import { useAnonymousPreferences } from '@/hooks/use-anonymous-preferences'
import { useClerkSessionHeaders } from '@/hooks/use-clerk-session-headers'
import { ChatMessagesList } from './chat-messages-list'
import { useChatHistory } from './hooks/use-chat-history'
import { useChatScroll } from './hooks/use-chat-scroll'
import { useChatStream } from './hooks/use-chat-stream'
import { useChatTOC } from './hooks/use-chat-toc'
import type { UseChatTOCResult } from './hooks/use-chat-toc/types'
import { ChatPanelFooter } from './chat-panel/panel-footer'
import { ChatPanelHeader } from './chat-panel/panel-header'
import { useActiveChatId } from './chat-panel/hooks/use-active-chat-id'
import { useChatActions } from './chat-panel/hooks/use-chat-actions'
import { useChatPerspectiveState } from './chat-panel/hooks/use-chat-perspective-state'
import { useOpenConversationsOnLoad } from './chat-panel/hooks/use-open-conversations-on-load'
import { useTocCompleteStep } from './chat-panel/hooks/use-toc-complete-step'

interface ChatPanelProps {
  libraryId: string
  variant?: 'default' | 'compact'
}

export function ChatPanel({ libraryId, variant = 'default' }: ChatPanelProps) {
  const { isSignedIn } = useUser()
  const isAnonymous = !isSignedIn
  const [configPopoverOpen, setConfigPopoverOpen] = useState(false)

  const { cfg, loading, error: configError } = useLibraryConfig(libraryId)
  const [error, setError] = useState<string | null>(configError)
  const [input, setInput] = useState('')
  const { activeChatId, setActiveChatId } = useActiveChatId(libraryId)
  const [answerLength, setAnswerLength] = useState<AnswerLength>(ANSWER_LENGTH_DEFAULT)
  const [retriever, setRetriever] = useState<Retriever>(RETRIEVER_DEFAULT)
  const setChatReferencesAtom = useSetAtom(chatReferencesAtom)
  const setChatReferences = useCallback(
    (refs: { references: ChatResponse['references']; queryId?: string }) => setChatReferencesAtom(refs),
    [setChatReferencesAtom],
  )

  const perspektive = useChatPerspectiveState()
  const { targetLanguage, character, accessPerspective, socialContext, llmModel, genderInclusive } = perspektive
  const { save: saveAnonymousPreferences } = useAnonymousPreferences()
  const sessionHeaders = useClerkSessionHeaders()

  // Konfig-Popover: beim Schliessen die Werte fuer anonyme Betrachter sichern.
  function handleConfigPopoverChange(open: boolean) {
    setConfigPopoverOpen(open)
    if (!open && isAnonymous) {
      saveAnonymousPreferences({
        targetLanguage,
        character: characterArrayToString(character),
        accessPerspective: accessPerspectiveArrayToString(accessPerspective),
        socialContext,
        genderInclusive,
      })
    }
  }

  // Galerie-Filter (Facetten) gehen als Teil des Cache-Schluessels mit.
  const galleryFilters = useAtomValue(galleryFiltersAtom)

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

  const { cachedTOC, isCheckingTOC, isGeneratingTOC, generateTOC, checkCache: checkTOCCache, setTOCData } = useChatTOC({
    libraryId, cfg, targetLanguage, character, socialContext, genderInclusive, galleryFilters, isEmbedded: false, isSending, sendQuestion, setProcessingSteps,
  })
  setTOCDataRef.current = setTOCData

  useTocCompleteStep({
    processingSteps,
    messages,
    setTOCData,
    params: { answerLength, retriever, targetLanguage, character, accessPerspective, socialContext, facetsSelected: galleryFilters || {}, llmModel },
  })

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  useChatScroll({ scrollRef, messages, openConversations, setOpenConversations, isSending, processingSteps, prevMessagesLengthRef })

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

  const padding = variant === 'compact' ? '' : 'p-6'
  if (loading) return <div className={padding}>Lade Chat...</div>
  if (error) return <div className={`${padding} text-destructive`}>{error}</div>
  if (!cfg) return <div className={padding}>Keine Konfiguration gefunden.</div>

  // Eine Frage (Anschlussfrage, Klick auf eine alte Frage) ins Eingabefeld uebernehmen.
  const frageUebernehmen = (text: string) => {
    setInput(text)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  return (
    <div className="w-full flex flex-col overflow-hidden flex-1 min-h-0">
      <ChatPanelHeader
        libraryId={libraryId}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        targetLanguage={targetLanguage}
        setTargetLanguage={perspektive.setTargetLanguage}
        character={character}
        setCharacter={perspektive.setCharacter}
        accessPerspective={accessPerspective}
        setAccessPerspective={perspektive.setAccessPerspective}
        socialContext={socialContext}
        setSocialContext={perspektive.setSocialContext}
        popoverOpen={configPopoverOpen}
        onPopoverOpenChange={handleConfigPopoverChange}
        answerLength={answerLength}
        setAnswerLength={setAnswerLength}
        retriever={retriever}
        setRetriever={setRetriever}
        genderInclusive={genderInclusive}
        setGenderInclusive={perspektive.setGenderInclusive}
        onGenerateTOC={generateTOC}
        onSavePreferences={saveUserPreferences}
      />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 h-full min-h-0" ref={scrollRef}>
          <div className={variant === 'compact' ? 'p-4' : 'p-6'}>
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
              onQuestionClick={frageUebernehmen}
              onDelete={handleDeleteQuery}
              onReload={handleReloadQuestion}
              messageRefs={messageRefs}
              isCheckingTOC={isCheckingTOC}
              isGeneratingTOC={isGeneratingTOC}
              cachedTOC={cachedTOC}
            />
            {/* Platzhalter: Hoehe setzt scrollElementToViewportTop (use-chat-scroll), damit die Frage oben buendig stehen kann. */}
            <div data-chat-scroll-spacer aria-hidden="true" />
          </div>
        </ScrollArea>

        <ChatPanelFooter
          input={input}
          setInput={setInput}
          onSend={onSend}
          isSending={isSending}
          answerLength={answerLength}
          setAnswerLength={setAnswerLength}
          placeholder={cfg.config.placeholder}
          inputRef={inputRef}
        />

        {cfg.config.footerText && variant !== 'compact' && (
          <div className="mt-4 text-xs text-muted-foreground px-4">
            {cfg.config.footerText} {cfg.config.companyLink ? (<a className="underline" href={cfg.config.companyLink} target="_blank" rel="noreferrer">mehr</a>) : null}
          </div>
        )}
      </div>
    </div>
  )
}
