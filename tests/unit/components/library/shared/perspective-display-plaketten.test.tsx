// @vitest-environment jsdom

/**
 * `PerspectiveDisplay variant="header"` zeigt die Perspektive als Plaketten (D9,
 * Figma Schritt 1). D10b (Owner 02.10., Platz ist wertvoll): nur Gesetztes —
 * „nicht spezifiziert" faellt weg, die Sprache nur, wenn sie von der
 * Oberflaechensprache abweicht; das Modell steht nicht im Kopf.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PerspectiveDisplay } from '@/components/library/shared/perspective-display'

const kontext = {
  targetLanguage: 'de',
  character: ['oekologie'],
  accessPerspective: ['undefined'],
  socialContext: 'allgemein',
  llmModel: 'google/gemini-2.5-flash',
  targetLanguageLabels: { de: 'Deutsch', it: 'Italienisch' },
  characterLabels: { oekologie: 'Ökologie', undefined: 'nicht spezifiziert' },
  accessPerspectiveLabels: { undefined: 'nicht spezifiziert' },
  socialContextLabels: { allgemein: 'Allgemeinverständlich', undefined: 'nicht spezifiziert' },
}
const mocks = vi.hoisted(() => ({ kontext: {} as Record<string, unknown> }))

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'de' }),
}))
vi.mock('@/hooks/use-story-context', () => ({ useStoryContext: () => mocks.kontext }))

afterEach(cleanup)

const plaketten = () => Array.from(screen.getByLabelText('gallery.storyMode.perspective.title').querySelectorAll('div')).map((el) => el.textContent)

describe('PerspectiveDisplay header (D9/D10b Plaketten)', () => {
  it('zeigt nur Gesetztes: Sprache gleich Oberflaeche und „nicht spezifiziert" fallen weg, kein Modell', () => {
    mocks.kontext = kontext
    render(<PerspectiveDisplay variant="header" />)
    expect(plaketten()).toEqual(['gallery.storyMode.perspective.character: Ökologie', 'gallery.storyMode.perspective.socialContext: Allgemeinverständlich'])
    expect(screen.getByLabelText('gallery.storyMode.perspective.title').textContent).not.toContain('gemini')
  })

  it('abweichende Sprache steht als Plakette; alles unspezifiziert → nichts', () => {
    mocks.kontext = { ...kontext, targetLanguage: 'it' }
    render(<PerspectiveDisplay variant="header" />)
    expect(plaketten()[0]).toBe('gallery.storyMode.perspective.language: Italienisch')
    cleanup()
    mocks.kontext = { ...kontext, character: ['undefined'], socialContext: 'undefined' }
    const { container } = render(<PerspectiveDisplay variant="header" />)
    expect(container.innerHTML).toBe('')
  })

  it('mit onClick sind die Plaketten Knoepfe und rufen den Rueckruf', () => {
    mocks.kontext = kontext
    const onClick = vi.fn()
    render(<PerspectiveDisplay variant="header" onClick={onClick} />)
    const knoepfe = screen.getAllByRole('button')
    expect(knoepfe).toHaveLength(2)
    fireEvent.click(knoepfe[1])
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
