'use client'

import { useState } from 'react'
import { User, Bot, Bug, Lightbulb } from 'lucide-react'
import { MarkdownPreview } from '../markdown-preview'
import { ChatSuggestedQuestions } from './chat-suggested-questions'
import { Button } from '@/components/ui/button'
import { BookOpen } from 'lucide-react'
import type { ChatResponse } from '@/types/chat-response'
import { QueryDetailsDialog } from './query-details-dialog'

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
  character?: 'developer' | 'business' | 'eco-social' | 'social' | 'open-source' | 'legal' | 'scientific'
}

/**
 * Gibt eine passende Pastellfarbe für den jeweiligen Charakter zurück
 */
function getCharacterColor(character?: 'developer' | 'business' | 'eco-social' | 'social' | 'open-source' | 'legal' | 'scientific'): string {
  const colors: Record<string, string> = {
    'developer': 'bg-blue-50 border-blue-200', // Blau für Tech/Code
    'business': 'bg-emerald-50 border-emerald-200', // Grün für Geschäft/Wachstum
    'eco-social': 'bg-green-50 border-green-200', // Grün für Umwelt/Nachhaltigkeit
    'social': 'bg-pink-50 border-pink-200', // Pink für Gemeinschaft/Soziales
    'open-source': 'bg-orange-50 border-orange-200', // Orange für Community/Energie
    'legal': 'bg-indigo-50 border-indigo-200', // Indigo für Professionell/Recht
    'scientific': 'bg-purple-50 border-purple-200', // Violett für Forschung/Wissen
  }
  return colors[character || ''] || 'bg-background border'
}

/**
 * Gibt eine passende Icon-Farbe für den jeweiligen Charakter zurück
 */
function getCharacterIconColor(character?: 'developer' | 'business' | 'eco-social' | 'social' | 'open-source' | 'legal' | 'scientific'): string {
  const colors: Record<string, string> = {
    'developer': 'bg-blue-100 text-blue-600',
    'business': 'bg-emerald-100 text-emerald-600',
    'eco-social': 'bg-green-100 text-green-600',
    'social': 'bg-pink-100 text-pink-600',
    'open-source': 'bg-orange-100 text-orange-600',
    'legal': 'bg-indigo-100 text-indigo-600',
    'scientific': 'bg-purple-100 text-purple-600',
  }
  return colors[character || ''] || 'bg-primary/10 text-primary'
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
  character
}: ChatMessageProps) {
  const [showDetails, setShowDetails] = useState(false)

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
            
            {/* Action-Buttons: Legende, Debug, Explain */}
            {(references && Array.isArray(references) && references.length > 0) || queryId ? (
              <div className="flex justify-end gap-2 mt-2 flex-wrap">
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
                      onClick={() => setShowDetails(true)}
                      className="h-6 text-xs text-muted-foreground hover:text-foreground"
                      title="Zeigt eine KI-generierte Erklärung, wie diese Antwort entstanden ist"
                    >
                      <Lightbulb className="h-3 w-3 mr-1" />
                      Explain
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
    </>
  )
}

