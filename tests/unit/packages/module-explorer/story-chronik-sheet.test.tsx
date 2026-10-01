// @vitest-environment jsdom

/**
 * Chronik-Sheet (D4): Der Slot-Inhalt steht nur im DOM, solange das Sheet
 * offen ist — kein zweiter Mount neben der Desktop-Spalte (Lehre aus M4h).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StoryChronikSheet } from '../../../../packages/module-explorer/src/gallery/components/story-chronik-sheet'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'de' }),
}))

afterEach(cleanup)

describe('StoryChronikSheet', () => {
  it('mountet den Inhalt nur offen', () => {
    const { rerender } = render(
      <StoryChronikSheet open={false} onOpenChange={() => undefined}>
        <div>Chronik-Inhalt</div>
      </StoryChronikSheet>,
    )
    expect(screen.queryByText('Chronik-Inhalt')).toBeNull()
    rerender(
      <StoryChronikSheet open onOpenChange={() => undefined}>
        <div>Chronik-Inhalt</div>
      </StoryChronikSheet>,
    )
    expect(screen.getByText('Chronik-Inhalt')).toBeTruthy()
    expect(screen.getByText('story.chronik.title')).toBeTruthy()
  })

  it('Schliessen-Knopf meldet onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(
      <StoryChronikSheet open onOpenChange={onOpenChange}>
        <div>Chronik-Inhalt</div>
      </StoryChronikSheet>,
    )
    fireEvent.click(screen.getByRole('button', { name: /close|schlie/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
