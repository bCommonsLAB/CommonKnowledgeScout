'use client'

import { useState, useEffect, useRef } from 'react'
import { User, Bot, Bug, FileText } from 'lucide-react'
import { MarkdownPreview } from '../markdown-preview'
import { ChatSuggestedQuestions } from './chat-suggested-questions'
import { ChatConfigDisplay } from './chat-config-display'
import { Button } from '@/components/ui/button'
import { BookOpen } from 'lucide-react'
import type { ChatResponse } from '@/types/chat-response'
import { QueryDetailsDialog } from './query-details-dialog'
import { ProcessingLogsDialog } from './processing-logs-dialog'
import type { Character, TargetLanguage, SocialContext, AnswerLength, Retriever } from '@/lib/chat/constants'
import type { ChatProcessingStep } from '@/types/chat-processing'
import { characterColors, characterIconColors } from '@/lib/chat/constants'

interface ChatMessageProps {
  type: 'question' | 'answer'
  content: string
  references?: ChatResponse['references']
  suggestedQuestions?: string[]
  queryId?: string
  createdAt: string
  libraryId: string
  onQuestionClick?: (question: string) => void
  messageId?: string
  innerRef?: (id: string, element: HTMLDivElement | null) => void
  character?: Character
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  socialContext?: SocialContext
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

export function ChatMessage({ 
  type, 
  content, 
  references, 
  suggestedQuestions,
  queryId,
  libraryId,
  onQuestionClick,
  messageId,
  innerRef,
  character,
  answerLength,
  retriever,
  targetLanguage,
  socialContext,
}: ChatMessageProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const lastMessageIdRef = useRef<string | undefined>(undefined)

  // Automatisch Legende öffnen, wenn eine Antwort mit Referenzen angezeigt wird
  useEffect(() => {
    if (type === 'answer' && references && Array.isArray(references) && references.length > 0) {
      // Nur auslösen, wenn es eine neue Nachricht ist (messageId hat sich geändert)
      if (messageId && messageId !== lastMessageIdRef.current) {
        lastMessageIdRef.current = messageId
        // Kurze Verzögerung, damit die Komponente vollständig gerendert ist
        const timer = setTimeout(() => {
          const event = new CustomEvent('show-reference-legend', {
            detail: { references, libraryId },
          })
          window.dispatchEvent(event)
        }, 100)
        return () => clearTimeout(timer)
      }
    }
  }, [type, references, libraryId, messageId])

  if (type === 'question') {
    const bgColor = getCharacterColor(character)
    const iconColor = getCharacterIconColor(character)
    
    return (
      <div 
        ref={(el) => {
          if (messageId && innerRef) {
            innerRef(messageId, el)
          }
        }}
        className="flex gap-3 mb-4"
      >
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-full ${iconColor} flex items-center justify-center transition-colors`}>
            <User className="h-4 w-4" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div 
            className={`${bgColor} border rounded-lg p-3 cursor-pointer hover:opacity-80 transition-all`}
            onClick={() => onQuestionClick?.(content)}
            title="Klicken Sie hier, um diese Frage erneut zu stellen"
          >
            <div className="text-sm whitespace-pre-wrap break-words">{content}</div>
            {/* Config-Anzeige unter der Frage - nur bei neuen Fragen (ohne queryId) */}
            {!queryId && (
              <ChatConfigDisplay
                answerLength={answerLength}
                retriever={retriever}
                targetLanguage={targetLanguage}
                character={character}
                socialContext={socialContext}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div 
        ref={(el) => {
          if (messageId && innerRef) {
            innerRef(messageId, el)
          }
        }}
        className="flex gap-3 mb-4"
      >
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <Bot className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-muted/30 border rounded-lg p-3">
            <div className="prose prose-sm max-w-none">
              <MarkdownPreview content={content} compact />
            </div>
            
            {/* Action-Buttons: Config, Legende, Logs, Debug */}
            {(references && Array.isArray(references) && references.length > 0) || queryId || (answerLength || retriever || targetLanguage || character || socialContext) ? (
              <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                {/* Config-Anzeige bei historischen Antworten (mit queryId) */}
                {queryId && (answerLength || retriever || targetLanguage || character || socialContext) && (
                  <div className="flex-1 min-w-0">
                    <ChatConfigDisplay
                      answerLength={answerLength}
                      retriever={retriever}
                      targetLanguage={targetLanguage}
                      character={character}
                      socialContext={socialContext}
                    />
                  </div>
                )}
                
                <div className="flex justify-end gap-2 flex-wrap">
                  {references && Array.isArray(references) && references.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const event = new CustomEvent('show-reference-legend', {
                          detail: { references, libraryId },
                        })
                        window.dispatchEvent(event)
                      }}
                      className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      Legende ({references.length})
                    </Button>
                  )}
                  
                  {queryId && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowLogs(true)}
                        className="h-6 text-xs text-muted-foreground hover:text-foreground"
                        title="Zeigt die Verarbeitungsschritte dieser Antwort"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Logs
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDetails(true)}
                        className="h-6 text-xs text-muted-foreground hover:text-foreground"
                        title="Zeigt technische Debug-Informationen zur Query"
                      >
                        <Bug className="h-3 w-3 mr-1" />
                        Debug
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {suggestedQuestions && suggestedQuestions.length > 0 && (
              <ChatSuggestedQuestions
                questions={suggestedQuestions}
                onQuestionClick={onQuestionClick || (() => {})}
              />
            )}
          </div>
        </div>
      </div>

      {/* Query Details Dialog */}
      {queryId && (
        <QueryDetailsDialog
          open={showDetails}
          onOpenChange={setShowDetails}
          libraryId={libraryId}
          queryId={queryId}
        />
      )}
      
      {/* Processing Logs Dialog */}
      {queryId && (
        <ProcessingLogsDialog
          open={showLogs}
          onOpenChange={setShowLogs}
          libraryId={libraryId}
          queryId={queryId}
        />
      )}
    </>
  )
}

