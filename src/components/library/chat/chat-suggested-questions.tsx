'use client'

import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/hooks'

interface ChatSuggestedQuestionsProps {
  questions: string[]
  onQuestionClick: (question: string) => void
}

/**
 * Component for displaying suggested questions as buttons
 */
export function ChatSuggestedQuestions({ questions, onQuestionClick }: ChatSuggestedQuestionsProps) {
  const { t } = useTranslation()
  
  if (questions.length === 0) return null

  return (
    <div className="mt-4 p-3 rounded border bg-muted/30">
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
        <HelpCircle className="h-3 w-3" />
        {t('suggestedQuestions.label')}
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="h-auto py-1.5 px-3 text-xs text-left whitespace-normal bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20"
            onClick={() => onQuestionClick(question)}
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  )
}

