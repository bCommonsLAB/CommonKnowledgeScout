// @vitest-environment jsdom
/**
 * Kopfzeile und populaere Fragen der Story-Sektion (09.11.2026, SFSCON):
 * der Filter-Chip zeigt den Facettenfilter, die populaeren Fragen kommen vom
 * Endpunkt und stellen beim Klick die Frage; ohne Treffer kein Block.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StoryStatus } from '@/components/library/website/story/website-story-status'
import { StoryPopulaereFragen } from '@/components/library/website/story/website-story-populaer'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join(',')}` : key),
    locale: 'de',
  }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('StoryStatus', () => {
  it('zeigt den Stand und den Filter-Chip mit lesbarer Beschriftung', () => {
    const { container } = render(<StoryStatus anzahl={2} filter={{ year: ['2026'] }} />)
    expect(screen.getByText('website.story.fragenInSitzung.many:2')).toBeTruthy()
    expect(screen.getByText('website.story.filterNur:year = 2026')).toBeTruthy()
    expect(container.querySelector('[data-story-filter="year = 2026"]')).not.toBeNull()
  })

  it('ohne Filter kein Chip', () => {
    const { container } = render(<StoryStatus anzahl={0} />)
    expect(screen.getByText('website.story.bereit')).toBeTruthy()
    expect(container.querySelector('[data-story-filter]')).toBeNull()
  })
})

describe('StoryPopulaereFragen', () => {
  it('laedt die Fragen vom Endpunkt und stellt sie beim Klick', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toContain('/api/chat/lib-1/popular-questions?limit=3')
      return { ok: true, status: 200, json: async () => ({ items: [{ question: 'Which talks are in English?', count: 4 }, { question: 'Where are the rooms?', count: 2 }] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const onFrage = vi.fn()
    render(<StoryPopulaereFragen libraryId="lib-1" n={3} onFrage={onFrage} />)
    await waitFor(() => expect(screen.getByText('Which talks are in English?')).toBeTruthy())
    expect(screen.getByText('website.story.populaer')).toBeTruthy()
    fireEvent.click(screen.getByText('Where are the rooms?'))
    expect(onFrage).toHaveBeenCalledWith('Where are the rooms?')
  })

  it('ohne Treffer kein Block; ein Fehler steht im Log', async () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'kaputt' }) })))
    const { container } = render(<StoryPopulaereFragen libraryId="lib-1" n={5} onFrage={() => undefined} />)
    await waitFor(() => expect(fehler).toHaveBeenCalled())
    expect(container.querySelector('[data-story-populaer]')).toBeNull()
    fehler.mockRestore()
  })
})
