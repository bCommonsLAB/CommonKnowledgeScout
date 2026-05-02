'use client'

/**
 * Topic-Liste fuer den Story-Modus.
 *
 * Rendert alle Themen als verschachteltes Accordion.
 * Zeigt ein Empty-State, wenn keine Themen vorhanden sind.
 */

import { Accordion } from '@/components/ui/accordion'
import { TopicCard } from './topic-card'
import type { StoryTopicsData, StoryQuestion } from '@/types/story-topics'

interface TopicListProps {
  /** Story-Daten mit Topics und Fragen */
  data: StoryTopicsData
  /** Callback wenn eine Frage ausgewaehlt wird */
  onSelectQuestion?: (question: StoryQuestion) => void
}

/**
 * Rendert alle Topics als verschachteltes Accordion.
 */
export function TopicList({ data, onSelectQuestion }: TopicListProps) {
  if (!data.topics || data.topics.length === 0) {
    // Bewusstes Conditional-Render: keine Topics vorhanden → kein Accordion-Render
    return null
  }

  return (
    <Accordion type="single" collapsible className="w-full border rounded-lg">
      {data.topics.map((topic) => (
        <TopicCard
          key={topic.id}
          topic={topic}
          onSelectQuestion={onSelectQuestion}
        />
      ))}
    </Accordion>
  )
}
