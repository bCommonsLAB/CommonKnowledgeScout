'use client'

import { useEffect, useRef, useState } from 'react'
import { User, Trash2, RotateCcw } from 'lucide-react'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { ChatMessage } from './chat-message'
import type { ChatResponse } from '@/types/chat-response'
import type { Character } from '@/lib/chat/constants'
import type { AnswerLength, Retriever, TargetLanguage, SocialContext } from '@/lib/chat/constants'
import { characterColors, characterIconColors } from '@/lib/chat/constants'

interface ConversationPair {
  question: {
    id: string
    content: string
    createdAt: string
    character?: Character
    answerLength?: AnswerLength
    retriever?: Retriever
    targetLanguage?: TargetLanguage
    socialContext?: SocialContext
    queryId?: string
  }
  answer?: {
    id: string
    content: string
    references?: ChatResponse['references']
    suggestedQuestions?: string[]
    queryId?: string
    createdAt: string
    answerLength?: AnswerLength
    retriever?: Retriever
    targetLanguage?: TargetLanguage
    character?: Character
    socialContext?: SocialContext
  }
}

interface ChatConversationItemProps {
  pair: ConversationPair
  conversationId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  onQuestionClick?: (question: string) => void
  onDelete?: (queryId: string) => Promise<void>
  onReload?: (question: string, config: { character?: Character; answerLength?: AnswerLength; retriever?: Retriever; targetLanguage?: TargetLanguage; socialContext?: SocialContext }) => Promise<void>
  innerRef?: (id: string, element: HTMLDivElement | null) => void
}

/**
 * Gibt eine passende Pastellfarbe für den jeweiligen Charakter zurück.
 * Verwendet die zentrale Farbdefinition aus types/character.ts.
 */
function getCharacterColor(character?: Character): string {
  if (!character) return 'bg-background border'
  return characterColors[character] || 'bg-background border'
}

/**
 * Gibt eine passende Icon-Farbe für den jeweiligen Charakter zurück.
 * Verwendet die zentrale Farbdefinition aus types/character.ts.
 */
function getCharacterIconColor(character?: Character): string {
  if (!character) return 'bg-primary/10 text-primary'
  return characterIconColors[character] || 'bg-primary/10 text-primary'
}

/**
 * Komponente für ein Frage-Antwort-Paar in einem Accordion
 */
export function ChatConversationItem({
  pair,
  conversationId,
  isOpen,
  onOpenChange,
  libraryId,
  onQuestionClick,
  onDelete,
  onReload,
  innerRef,
}: ChatConversationItemProps) {
  const accordionRef = useRef<HTMLDivElement>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isReloading, setIsReloading] = useState(false)
  
  const bgColor = getCharacterColor(pair.question.character)
  const iconColor = getCharacterIconColor(pair.question.character)

  // Auto-Scroll zu diesem Accordion, wenn es geöffnet wird
  useEffect(() => {
    if (isOpen && accordionRef.current) {
      // Kurze Verzögerung, damit die Animation abgeschlossen ist
      const timer = setTimeout(() => {
        accordionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])
  
  // Beobachte Änderungen des Accordion-Status über MutationObserver
  useEffect(() => {
    const accordionElement = accordionRef.current
    if (!accordionElement) return
    
    const observer = new MutationObserver(() => {
      const accordionItem = accordionElement.querySelector('[data-state]')
      const currentState = accordionItem?.getAttribute('data-state')
      const isCurrentlyOpen = currentState === 'open'
      if (isCurrentlyOpen !== isOpen) {
        onOpenChange(isCurrentlyOpen)
      }
    })
    
    observer.observe(accordionElement, {
      attributes: true,
      attributeFilter: ['data-state'],
      subtree: true,
    })
    
    return () => observer.disconnect()
  }, [isOpen, onOpenChange])

  const hasAnswer = !!pair.answer
  const queryId = pair.question.queryId || pair.answer?.queryId

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation() // Verhindere, dass das Accordion geöffnet/geschlossen wird
    if (!queryId || !onDelete) return
    
    if (!confirm('Möchten Sie diese Frage wirklich löschen?')) return
    
    setIsDeleting(true)
    try {
      await onDelete(queryId)
    } catch (error) {
      console.error('[ChatConversationItem] Fehler beim Löschen:', error)
      alert(error instanceof Error ? error.message : 'Fehler beim Löschen der Frage')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleReload(e: React.MouseEvent) {
    e.stopPropagation() // Verhindere, dass das Accordion geöffnet/geschlossen wird
    if (!onReload) return
    
    setIsReloading(true)
    try {
      await onReload(pair.question.content, {
        character: pair.question.character,
        answerLength: pair.question.answerLength,
        retriever: pair.question.retriever,
        targetLanguage: pair.question.targetLanguage,
        socialContext: pair.question.socialContext,
      })
    } finally {
      setIsReloading(false)
    }
  }

  return (
    <div ref={accordionRef} data-conversation-id={conversationId}>
      <Accordion type="single" collapsible value={isOpen ? conversationId : undefined}>
        <AccordionItem value={conversationId} className="border-b">
          <div className="flex items-center gap-2">
            <AccordionTrigger className="px-4 py-3 hover:no-underline flex-1 min-w-0">
            <div className="flex gap-3 items-center flex-1 min-w-0 mr-2">
              {/* User-Icon */}
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 rounded-full ${iconColor} flex items-center justify-center transition-colors`}>
                  <User className="h-4 w-4" />
                </div>
              </div>
              
              {/* Frage-Text mit Hintergrundfarbe - linksbündig */}
              <div className={`flex-1 min-w-0 ${bgColor} border rounded-lg p-3 cursor-pointer hover:opacity-80 transition-all text-left`}>
                <div className="text-sm whitespace-pre-wrap break-words">{pair.question.content}</div>
              </div>
              </div>
            </AccordionTrigger>
              
            {/* Action-Buttons: Reload und Delete - außerhalb des AccordionTrigger */}
            <div className="flex items-center gap-1 flex-shrink-0 pr-2">
                {onReload && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReload}
                    disabled={isReloading || isDeleting}
                    className="h-6 w-6 p-0 hover:bg-muted"
                    title="Frage neu stellen"
                  >
                    <RotateCcw className={`h-3 w-3 ${isReloading ? 'animate-spin' : ''}`} />
                  </Button>
                )}
                {onDelete && queryId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting || isReloading}
                    className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                    title="Frage löschen"
                  >
                    <Trash2 className={`h-3 w-3 ${isDeleting ? 'animate-pulse' : ''}`} />
                  </Button>
                )}
              </div>
            </div>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4 pt-2">
              {/* Nur Antwort anzeigen - Frage ist bereits im Trigger */}
              {hasAnswer && pair.answer && (
                <ChatMessage
                  messageId={pair.answer.id}
                  type="answer"
                  content={pair.answer.content}
                  references={pair.answer.references}
                  suggestedQuestions={pair.answer.suggestedQuestions}
                  queryId={pair.answer.queryId}
                  createdAt={pair.answer.createdAt}
                  libraryId={libraryId}
                  answerLength={pair.answer.answerLength}
                  retriever={pair.answer.retriever}
                  targetLanguage={pair.answer.targetLanguage}
                  character={pair.answer.character}
                  socialContext={pair.answer.socialContext}
                  innerRef={innerRef}
                  onQuestionClick={onQuestionClick}
                />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

