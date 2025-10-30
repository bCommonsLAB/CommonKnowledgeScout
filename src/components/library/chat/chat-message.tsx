'use client'

import { User, Bot } from 'lucide-react'
import { MarkdownPreview } from '../markdown-preview'
import { ChatSuggestedQuestions } from './chat-suggested-questions'
import { Button } from '@/components/ui/button'
import { BookOpen } from 'lucide-react'
import type { ChatResponse } from '@/types/chat-response'

interface ChatMessageProps {
  type: 'question' | 'answer'
  content: string
  references?: ChatResponse['references']
  suggestedQuestions?: string[]
  queryId?: string
  createdAt: string
  libraryId: string
  onQuestionClick?: (question: string) => void
}

export function ChatMessage({ 
  type, 
  content, 
  references, 
  suggestedQuestions,
  libraryId,
  onQuestionClick 
}: ChatMessageProps) {
  if (type === 'question') {
    return (
      <div className="flex gap-3 mb-4">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-background border rounded-lg p-3">
            <div className="text-sm whitespace-pre-wrap break-words">{content}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 mb-4">
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
          {references && references.length > 0 && (
            <div className="flex justify-end mt-2">
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
            </div>
          )}
          {suggestedQuestions && suggestedQuestions.length > 0 && (
            <ChatSuggestedQuestions
              questions={suggestedQuestions}
              onQuestionClick={onQuestionClick || (() => {})}
            />
          )}
        </div>
      </div>
    </div>
  )
}

