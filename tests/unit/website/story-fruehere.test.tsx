// @vitest-environment jsdom
/**
 * Verweis „N fruehere Fragen“ unter der Antwort (08.11.2026), seit WE2 ueber
 * `appNavigation` (Ziel `story` mit `frage`): Site-Modus Rueckruf mit `q`,
 * Root-Modus Adresse des Story-Modus mit `q`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { FrageAntwort } from '@ks/module-story/react'
import { StoryFruehereFragen } from '@/components/library/website/story/website-story-fruehere'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join(',')}` : key),
    locale: 'de',
  }),
}))

const PAARE = [
  { frage: { queryId: 'q-1' }, antwort: { queryId: 'q-1' } },
  { frage: { queryId: 'q-2' }, antwort: { queryId: 'q-2' } },
  { frage: { queryId: 'q-3' } },
] as unknown as FrageAntwort[]

afterEach(cleanup)

describe('StoryFruehereFragen', () => {
  it('Site-Modus: Klick wechselt mit der juengsten frueheren Frage', () => {
    const onShowStory = vi.fn()
    render(<StoryFruehereFragen paare={PAARE} navigation={{ onShowStory, galleryBaseHref: null, storyBaseHref: null }} />)
    const link = screen.getByText('website.story.fruehereFragen.many:2')
    expect(link.getAttribute('href')).toBe('?mode=story&q=q-2')
    expect(fireEvent.click(link)).toBe(false)
    expect(onShowStory).toHaveBeenCalledWith({ q: 'q-2' })
  })

  it('Root-Modus: Adresse des Story-Modus mit q, ohne Rueckruf', () => {
    render(<StoryFruehereFragen paare={PAARE} navigation={{ galleryBaseHref: '/explore/x?view=gallery', storyBaseHref: '/explore/x?mode=story' }} />)
    const link = screen.getByText('website.story.fruehereFragen.many:2')
    expect(link.getAttribute('href')).toBe('/explore/x?mode=story&q=q-2')
    expect(fireEvent.click(link)).toBe(true)
  })

  it('hoechstens ein Paar: kein Verweis', () => {
    const { container } = render(<StoryFruehereFragen paare={PAARE.slice(0, 1)} navigation={{ galleryBaseHref: null, storyBaseHref: null }} />)
    expect(container.innerHTML).toBe('')
  })
})
