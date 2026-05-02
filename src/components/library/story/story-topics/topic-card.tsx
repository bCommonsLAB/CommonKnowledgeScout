'use client'

/**
 * Einzelne Topic-Karte im Story-Modus.
 *
 * Rendert ein einzelnes Thema als AccordionItem mit klickbaren Fragen.
 */

import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import type { StoryTopic, StoryQuestion } from '@/types/story-topics'

interface TopicCardProps {
  topic: StoryTopic
  onSelectQuestion?: (question: StoryQuestion) => void
}

/**
 * Rendert ein Topic als Accordion-Eintrag mit Fragen-Buttons.
 */
export function TopicCard({ topic, onSelectQuestion }: TopicCardProps) {
  return (
    <AccordionItem key={topic.id} value={topic.id} className="border-b last:border-b-0">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex flex-col items-start text-left">
          <span className="font-medium">{topic.title}</span>
          {topic.summary && (
            <span className="text-xs text-muted-foreground mt-1">{topic.summary}</span>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-2 mt-2">
          {topic.questions.map((question) => (
            <Button
              key={question.id}
              variant="outline"
              size="sm"
              className="w-full justify-start text-left h-auto py-2 text-xs bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 whitespace-normal break-words"
              onClick={() => onSelectQuestion?.(question)}
            >
              <span className="text-left">{question.text}</span>
            </Button>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
