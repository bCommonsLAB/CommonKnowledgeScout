// @vitest-environment jsdom

/**
 * `StoryHinweis` (D10): einmaliger Hinweis zur Bedienung — Titel und Text vom
 * Gastgeber, Zusatzzeile und Knopf aus der Uebersetzung, „Verstanden" ruft
 * den Rueckruf.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StoryHinweis } from '../../../../packages/module-story/src/react/story-hinweis'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'de' }),
}))

afterEach(cleanup)

describe('StoryHinweis', () => {
  it('zeigt Titel, Text, Zusatzzeile und meldet Verstanden', () => {
    const onVerstanden = vi.fn()
    render(<StoryHinweis titel="So geht es" text="Wähle deine Perspektive." onVerstanden={onVerstanden} />)
    const note = screen.getByRole('note')
    expect(note.textContent).toContain('So geht es')
    expect(note.textContent).toContain('Wähle deine Perspektive.')
    expect(note.textContent).toContain('story.hinweis.einmalig')
    fireEvent.click(screen.getByRole('button', { name: /story.hinweis.verstanden/ }))
    expect(onVerstanden).toHaveBeenCalledTimes(1)
  })
})
