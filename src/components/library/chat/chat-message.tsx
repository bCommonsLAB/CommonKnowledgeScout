'use client'

import { useState } from 'react'
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
import { characterColors, characterIconColors } from '@/lib/chat/constants'
import { useUser } from '@clerk/nextjs'
import { AIGeneratedNotice } from '@/components/shared/ai-generated-notice'
import { ChatFiltersDisplay } from './chat-filters-display'
import { AppLogo } from '@/components/shared/app-logo'

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
  character?: Character[] // Array (kann leer sein)
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  socialContext?: SocialContext
  filters?: Record<string, unknown> // Optional: Filterparameter direkt übergeben
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
  filters,
}: ChatMessageProps) {
  const { isSignedIn } = useUser()
  const [showDetails, setShowDetails] = useState(false)
  const [showLogs, setShowLogs] = useState(false)

  // Automatisches Öffnen des Quellenverzeichnisses wurde deaktiviert - Benutzer soll Zeit haben, die Antwort zu lesen

  if (type === 'question') {
    // Verwende ersten Wert für Farben (kann undefined sein)
    const characterValue = character && character.length > 0 ? character[0] : undefined
    const bgColor = getCharacterColor(characterValue)
    const iconColor = getCharacterIconColor(characterValue)
    
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
                libraryId={libraryId}
                queryId={queryId}
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
          <AppLogo 
            size={32} 
            fallback={<Bot className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-muted/30 border rounded-lg p-3">
            {/* Filter-Anzeige oben bei der Antwort */}
            {queryId && (
              <ChatFiltersDisplay libraryId={libraryId} queryId={queryId} />
            )}
            
            <div className="prose prose-sm max-w-none">
              <MarkdownPreview content={content} compact />
            </div>
            
            {/* KI-Info-Hinweis unter jeder Antwort */}
            <AIGeneratedNotice 
              sources={references?.map(ref => ({
                id: ref.fileId || String(ref.number),
                fileName: ref.fileName
              }))}
            />
            
            {/* Action-Buttons: Config, Quellenverzeichnis, Logs, Debug */}
            {(references && Array.isArray(references) && references.length > 0) || queryId || (answerLength || retriever || targetLanguage || character || socialContext) ? (
              <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
                {/* Config-Anzeige bei historischen Antworten (mit queryId) - zeigt auch Filterparameter */}
                {queryId && (
                  <div className="flex-1 min-w-0">
                    <ChatConfigDisplay
                      answerLength={answerLength}
                      retriever={retriever}
                      targetLanguage={targetLanguage}
                      character={character}
                      socialContext={socialContext}
                      libraryId={libraryId}
                      queryId={queryId}
                      filters={filters}
                    />
                  </div>
                )}
                
                <div className="flex justify-end gap-2 flex-wrap items-center">
                  {/* Quelle-Button - prominent wie der Fragen-Button */}
                  {references && Array.isArray(references) && references.length > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        const event = new CustomEvent('show-reference-legend', {
                          detail: { references, libraryId },
                        })
                        window.dispatchEvent(event)
                      }}
                      className="h-9 px-4 gap-2 font-medium"
                    >
                      <BookOpen className="h-4 w-4" />
                      Quelle ({references.length})
                    </Button>
                  )}
                  
                  {queryId && (
                    <>
                      {/* Logs-Button nur für eingeloggte Benutzer */}
                      {isSignedIn && (
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
                      )}
                      
                      {/* Debug-Button nur für eingeloggte Benutzer */}
                      {isSignedIn && (
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
                      )}
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
      
      {/* Processing Logs Dialog - nur für eingeloggte Benutzer */}
      {queryId && isSignedIn && (
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

