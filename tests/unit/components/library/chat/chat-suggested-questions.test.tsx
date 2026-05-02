// @vitest-environment jsdom

/**
 * Characterization Tests fuer `ChatSuggestedQuestions` (Welle 3-III, Schritt 3).
 *
 * Sicherheitsnetz fuer Sub-Welle 3-III-b. Fixiert:
 * - Render-Smoke mit Frage-Liste
 * - onQuestionClick wird mit der Frage als Argument aufgerufen
 * - Leere Liste → null-Render (kein DOM-Output)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { ChatSuggestedQuestions } from '@/components/library/chat/chat-suggested-questions'

vi.mock('@/lib/i18n/hooks', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('ChatSuggestedQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert nichts, wenn Frage-Liste leer ist', () => {
    const { container } = render(
      <ChatSuggestedQuestions questions={[]} onQuestionClick={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('rendert eine Liste von Frage-Buttons', () => {
    const questions = ['Was ist Klimaschutz?', 'Wer hat die Bibel geschrieben?']
    render(<ChatSuggestedQuestions questions={questions} onQuestionClick={vi.fn()} />)
    for (const q of questions) {
      expect(screen.getByText(q)).toBeTruthy()
    }
  })

  it('ruft onQuestionClick mit der gewaehlten Frage auf', () => {
    const onClick = vi.fn()
    const question = 'Welche Argumente nennen Klima-Skeptiker?'
    render(<ChatSuggestedQuestions questions={[question]} onQuestionClick={onClick} />)

    const button = screen.getByText(question)
    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith(question)
  })

  it('rendert i18n-Label aus dem Translation-Key (suggestedQuestions.label)', () => {
    render(<ChatSuggestedQuestions questions={['F']} onQuestionClick={vi.fn()} />)
    // Der Mock ueber useTranslation gibt den Key zurueck → wir koennen ihn finden
    expect(screen.getByText('suggestedQuestions.label')).toBeTruthy()
  })
})
