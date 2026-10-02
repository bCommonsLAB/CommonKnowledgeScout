// @vitest-environment jsdom

/**
 * `PerspectiveDisplay variant="header"` zeigt die Perspektive als Plaketten (D9,
 * Plan `story-dreiteilung-fragenchronik`, Figma Schritt 1) — nicht mehr als
 * Info-Symbol mit Tooltip.
 *
 * Beweis-Ziele: eine Plakette je gesetztem Wert, leere Werte lassen die
 * Plakette weg, das Modell steht nicht im Kopf, Klick ruft `onClick`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PerspectiveDisplay } from '@/components/library/shared/perspective-display'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'de' }),
}))

vi.mock('@/hooks/use-story-context', () => ({
  useStoryContext: () => ({
    targetLanguage: 'de',
    character: ['oekologie'],
    accessPerspective: [],
    socialContext: 'allgemein',
    llmModel: 'google/gemini-2.5-flash',
    targetLanguageLabels: { de: 'Deutsch' },
    characterLabels: { oekologie: 'Ökologie' },
    accessPerspectiveLabels: {},
    socialContextLabels: { allgemein: 'Allgemeinverständlich' },
  }),
}))

afterEach(cleanup)

describe('PerspectiveDisplay header (D9 Plaketten)', () => {
  it('zeigt eine Plakette je Wert, ohne Zugang (leer) und ohne Modell', () => {
    render(<PerspectiveDisplay variant="header" />)
    const plaketten = screen.getByLabelText('gallery.storyMode.perspective.title')
    const texte = Array.from(plaketten.querySelectorAll('div')).map((el) => el.textContent)
    expect(texte).toEqual([
      'gallery.storyMode.perspective.language: Deutsch',
      'gallery.storyMode.perspective.character: Ökologie',
      'gallery.storyMode.perspective.socialContext: Allgemeinverständlich',
    ])
    expect(plaketten.querySelector('button')).toBeNull()
    expect(plaketten.textContent).not.toContain('gemini')
  })

  it('mit onClick sind die Plaketten Knoepfe und rufen den Rueckruf', () => {
    const onClick = vi.fn()
    render(<PerspectiveDisplay variant="header" onClick={onClick} />)
    const knoepfe = screen.getAllByRole('button')
    expect(knoepfe).toHaveLength(3)
    fireEvent.click(knoepfe[1])
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
