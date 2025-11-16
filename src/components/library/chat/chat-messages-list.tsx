'use client'

import { ChatConversationItem } from './chat-conversation-item'
import { ProcessingStatus } from './processing-status'
import { ChatConfigDisplay } from './chat-config-display'
import type { ChatMessage } from './utils/chat-utils'
import { groupMessagesToConversations } from './utils/chat-utils'
import type { ChatProcessingStep } from '@/types/chat-processing'
import type { Character, AnswerLength, Retriever, TargetLanguage, SocialContext } from '@/lib/chat/constants'
import { useTranslation } from '@/lib/i18n/hooks'

interface ChatMessagesListProps {
  messages: ChatMessage[]
  openConversations: Set<string>
  setOpenConversations: React.Dispatch<React.SetStateAction<Set<string>>>
  libraryId: string
  isSending: boolean
  processingSteps: ChatProcessingStep[]
  error: string | null
  answerLength: AnswerLength
  retriever: Retriever
  targetLanguage: TargetLanguage
  character: Character[] // Array (kann leer sein)
  socialContext: SocialContext
  filters?: Record<string, unknown> // Optional: Filterparameter für Anzeige während Verarbeitung
  onQuestionClick: (question: string) => void
  onDelete: (queryId: string) => Promise<void>
  onReload: (question: string, config: {
    character?: Character[] // Array (kann leer sein)
    answerLength?: AnswerLength
    retriever?: Retriever
    targetLanguage?: TargetLanguage
    socialContext?: SocialContext
  }) => Promise<void>
  messageRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  isEmbedded?: boolean
  isCheckingTOC?: boolean
  cachedTOC?: unknown
  cachedStoryTopicsData?: unknown
}

/**
 * Komponente für die Liste der Chat-Conversations
 * 
 * Rendert:
 * - Liste der Frage-Antwort-Paare
 * - Verarbeitungsstatus während des Sendens
 * - Fehlermeldungen
 */
export function ChatMessagesList({
  messages,
  openConversations,
  setOpenConversations,
  libraryId,
  isSending,
  processingSteps,
  error,
  answerLength,
  retriever,
  targetLanguage,
  character,
  socialContext,
  filters,
  onQuestionClick,
  onDelete,
  onReload,
  messageRefs,
  isEmbedded = false,
  isCheckingTOC = false,
  cachedTOC = null,
  cachedStoryTopicsData = null,
}: ChatMessagesListProps) {
  const { t } = useTranslation()
  const conversations = groupMessagesToConversations(messages)

  // Leerer Zustand / Startnachricht - nicht im embedded Modus
  if (!isEmbedded && !isCheckingTOC && !cachedTOC && messages.length === 0 && !isSending) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="text-4xl mb-4">💡</div>
        <h3 className="text-lg font-medium mb-2">{t('chatMessages.welcomeTitle')}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          {t('chatMessages.welcomeDescription')}
        </p>
        <p className="text-xs text-muted-foreground max-w-md">
          {t('chatMessages.welcomeTip')}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Conversations-Liste */}
      {conversations.map((conv) => {
        const isOpen = openConversations.has(conv.conversationId)
        return (
          <div key={conv.conversationId} data-conversation-id={conv.conversationId}>
            <ChatConversationItem
              pair={{
                question: {
                  id: conv.question.id,
                  content: conv.question.content,
                  createdAt: conv.question.createdAt,
                  character: conv.question.character,
                  answerLength: conv.question.answerLength,
                  retriever: conv.question.retriever,
                  targetLanguage: conv.question.targetLanguage,
                  socialContext: conv.question.socialContext,
                  queryId: conv.question.queryId,
                },
                answer: conv.answer ? {
                  id: conv.answer.id,
                  content: conv.answer.content,
                  references: conv.answer.references,
                  suggestedQuestions: conv.answer.suggestedQuestions,
                  queryId: conv.answer.queryId,
                  createdAt: conv.answer.createdAt,
                  answerLength: conv.answer.answerLength,
                  retriever: conv.answer.retriever,
                  targetLanguage: conv.answer.targetLanguage,
                  character: conv.answer.character,
                  socialContext: conv.answer.socialContext,
                } : undefined,
              }}
              conversationId={conv.conversationId}
              isOpen={isOpen}
              onOpenChange={(open) => {
                setOpenConversations(prev => {
                  const next = new Set(prev)
                  if (open) {
                    next.add(conv.conversationId)
                  } else {
                    next.delete(conv.conversationId)
                  }
                  return next
                })
              }}
              libraryId={libraryId}
              filters={filters}
              onQuestionClick={onQuestionClick}
              onDelete={onDelete}
              onReload={onReload}
              innerRef={(id, el) => {
                if (el) {
                  messageRefs.current.set(id, el)
                } else {
                  messageRefs.current.delete(id)
                }
              }}
            />
          </div>
        )
      })}

      {/* Verarbeitungsstatus während des Sendens ODER Cache-Check */}
      {/* WICHTIG: Verstecke Verarbeitungsinfo, wenn Cache gefunden wurde und keine aktive Generierung läuft */}
      {/* Processing-Status nur anzeigen wenn:
          1. Normale Frage gesendet wird (isSending) ODER
          2. TOC wird geprüft/generiert UND wir sind NICHT im embedded Modus (dort wird StoryTopics mit eigenem Icon angezeigt) ODER
          3. Cache-Check läuft UND wir sind NICHT im embedded Modus UND keine TOC-Daten vorhanden
      */}
      {(isSending || (!isEmbedded && ((isCheckingTOC && !cachedStoryTopicsData && !cachedTOC) || (processingSteps.some(s => s.type === 'cache_check' || s.type === 'cache_check_complete') && !cachedStoryTopicsData && !cachedTOC)))) && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="bg-muted/30 border rounded-lg p-3">
              <div className="text-sm text-muted-foreground">{t('chatMessages.processing')}</div>
              {/* Konfigurationsparameter während der Berechnung anzeigen */}
              <div className="mt-2">
                <ChatConfigDisplay
                  answerLength={answerLength}
                  retriever={retriever}
                  targetLanguage={targetLanguage}
                  character={character}
                  socialContext={socialContext}
                  libraryId={libraryId}
                  filters={filters}
                />
              </div>
              {/* Processing Steps - dezent innerhalb des Blocks */}
              {processingSteps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <ProcessingStatus steps={processingSteps} isActive={isSending || isCheckingTOC} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fehlermeldung */}
      {error && (
        <div className="text-sm text-destructive p-3 bg-destructive/10 rounded border border-destructive/20">
          {error}
        </div>
      )}
    </>
  )
}

