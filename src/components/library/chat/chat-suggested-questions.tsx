'use client'

import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'

interface ChatSuggestedQuestionsProps {
  questions: string[]
  onQuestionClick: (question: string) => void
}

/**
 * Komponente für die Anzeige von vorgeschlagenen Fragen als Buttons
 */
export function ChatSuggestedQuestions({ questions, onQuestionClick }: ChatSuggestedQuestionsProps) {
  if (questions.length === 0) return null

  return (
    <div className="mt-4 p-3 rounded border bg-muted/30">
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
        <HelpCircle className="h-3 w-3" />
        Mögliche weitere Fragen zum Thema, die sich aus den Quellen ergeben:
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="h-auto py-1.5 px-3 text-xs text-left whitespace-normal"
            onClick={() => onQuestionClick(question)}
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  )
}

