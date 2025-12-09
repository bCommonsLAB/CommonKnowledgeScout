'use client'

import { useRef, useState } from 'react'
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
    character?: Character[] // Array (kann leer sein)
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
    character?: Character[] // Array (kann leer sein)
    socialContext?: SocialContext
  }
}

interface ChatConversationItemProps {
  pair: ConversationPair
  conversationId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  filters?: Record<string, unknown> // Optional: Filterparameter für Anzeige
  onQuestionClick?: (question: string) => void
  onDelete?: (queryId: string) => Promise<void>
  onReload?: (question: string, config: { character?: Character[]; answerLength?: AnswerLength; retriever?: Retriever; targetLanguage?: TargetLanguage; socialContext?: SocialContext }) => Promise<void>
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
  filters,
  onQuestionClick,
  onDelete,
  onReload,
  innerRef,
}: ChatConversationItemProps) {
  const accordionRef = useRef<HTMLDivElement>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isReloading, setIsReloading] = useState(false)
  
  // Verwende ersten Wert für Farben (kann undefined sein)
  const characterValue = pair.question.character && pair.question.character.length > 0 ? pair.question.character[0] : undefined
  const bgColor = getCharacterColor(characterValue)
  const iconColor = getCharacterIconColor(characterValue)

  // Auto-Scroll wurde deaktiviert - Benutzer möchte nicht automatisch scrollen
  
  // Handler für Accordion-Änderungen direkt über onClick im AccordionTrigger
  // Der MutationObserver wurde entfernt, da er mit dem kontrollierten Accordion-State kollidierte
  // und die Klicks blockierte. Stattdessen verwenden wir einen direkten Handler.

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
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Löschen der Frage'
      
      // Zeige benutzerfreundliche Fehlermeldung
      if (errorMessage.includes('Not found') || errorMessage.includes('nicht gefunden')) {
        alert('Die Frage konnte nicht gefunden werden. Möglicherweise wurde sie bereits gelöscht oder gehört zu einer anderen Sitzung.')
      } else {
        alert(errorMessage)
      }
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

  // Handler für Accordion-Value-Änderungen
  // Da das Accordion kontrolliert ist, müssen wir auf interne Änderungen reagieren
  const handleAccordionValueChange = (value: string | undefined) => {
    // Wenn value undefined ist, bedeutet das, dass das Accordion geschlossen werden soll
    // Wenn value === conversationId ist, bedeutet das, dass dieses Accordion geöffnet werden soll
    const shouldBeOpen = value === conversationId
    // Rufe immer onOpenChange auf, damit der State synchronisiert wird
    // Dies ermöglicht es auch, den letzten Accordion zu schließen
    onOpenChange(shouldBeOpen)
  }

  return (
    <div ref={accordionRef} data-conversation-id={conversationId}>
      <Accordion 
        type="single" 
        collapsible 
        value={isOpen ? conversationId : undefined}
        onValueChange={handleAccordionValueChange}
      >
        <AccordionItem value={conversationId} className="border-b">
          <div className="flex items-center gap-2 relative">
            {/* VARIANTE 3 BEHOBEN: AccordionTrigger muss den gesamten Bereich abdecken */}
            {/* Die Buttons sind absolut positioniert, damit sie nicht den Trigger blockieren */}
            <AccordionTrigger className="px-0 py-3 hover:no-underline flex-1 min-w-0 pr-20">
            <div className="flex gap-3 items-center flex-1 min-w-0">
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
              
            {/* VARIANTE 3 BEHOBEN: Action-Buttons absolut positioniert, damit sie nicht den Trigger blockieren */}
            {/* Mehr Platz rechts (pr-20 statt pr-12) damit die Frage nicht mit den Buttons überlappt */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 flex-shrink-0 z-10">
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
          <AccordionContent className="px-0 pb-4">
            <div className="space-y-4 pt-2">
              {/* Nur Antwort anzeigen - Frage ist bereits im Trigger */}
              {hasAnswer && pair.answer && (
                <ChatMessage
                  messageId={pair.answer.id}
                  type="answer"
                  content={pair.answer.content}
                  references={pair.answer.references}
                  suggestedQuestions={pair.answer.suggestedQuestions}
                  queryId={pair.answer.queryId || pair.question.queryId}
                  createdAt={pair.answer.createdAt}
                  libraryId={libraryId}
                  answerLength={pair.answer.answerLength}
                  retriever={pair.answer.retriever}
                  targetLanguage={pair.answer.targetLanguage}
                  character={pair.answer.character}
                  socialContext={pair.answer.socialContext}
                  filters={filters}
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

