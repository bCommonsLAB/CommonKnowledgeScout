// @vitest-environment jsdom
/**
 * Themenkarten der Sektion `layout=topics` (Owner 18.11.2026): eine Karte je
 * Thema mit Kurztext und Fragen; der Klick gibt die Frage weiter. Ohne Kinder
 * zeigt der Rahmen den Hinweis fuer die Archiv-Vorschau.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { StoryTopic } from '@ks/contracts'
import { ThemenKarten, WebsiteThemenRahmen } from '@ks/module-website/react'
import { parseWebsiteSections } from '@ks/module-website'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join(',')}` : key),
    locale: 'de',
  }),
}))

/** jsdom kennt kein `matchMedia`: breit ist die Vorgabe, `schmal` stellt das Telefon. */
function breite(schmal: boolean) {
  window.matchMedia = ((query: string) => ({ matches: schmal, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
}
beforeEach(() => breite(false))
afterEach(() => cleanup())

const THEMEN: StoryTopic[] = [
  { id: 't1', title: 'Miteinander', summary: 'Werte und Rituale', questions: [{ id: 'q1', text: 'Wie pflegen wir Rituale?' }, { id: 'q2', text: 'Was hilft bei Streit?' }] },
  { id: 't2', title: 'Wirtschaften', questions: [{ id: 'q3', text: 'Wie teilen wir Risiken?' }] },
]

describe('ThemenKarten', () => {
  it('zeigt je Thema Titel, Kurztext und Fragen', () => {
    const { container } = render(<ThemenKarten themen={THEMEN} onFrage={() => {}} />)
    expect(container.querySelector('[data-themen-karten="2"]')).not.toBeNull()
    expect(screen.getByText('Miteinander')).toBeTruthy()
    expect(screen.getByText('Werte und Rituale')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'website.story.themenFragen:Miteinander' })).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('gibt die angeklickte Frage weiter', () => {
    const onFrage = vi.fn()
    render(<ThemenKarten themen={THEMEN} onFrage={onFrage} />)
    fireEvent.click(screen.getByText('Wie teilen wir Risiken?'))
    expect(onFrage).toHaveBeenCalledWith('Wie teilen wir Risiken?')
  })
})

describe('ThemenKarten auf dem Telefon (R2)', () => {
  it('Akkordeon: das erste Thema ist offen, ein Tipp auf den Titel wechselt', () => {
    breite(true)
    const { container } = render(<ThemenKarten themen={THEMEN} onFrage={() => {}} />)
    const koepfe = container.querySelectorAll('[data-thema-kopf]')
    expect(koepfe).toHaveLength(2)
    expect(koepfe[0].getAttribute('aria-expanded')).toBe('true')
    expect(koepfe[1].getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(koepfe[1])
    expect(koepfe[0].getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelectorAll('[data-thema-offen="true"]')).toHaveLength(1)
    expect(container.querySelector('[data-thema-offen="true"]')?.textContent).toContain('Wirtschaften')
  })
})

describe('ThemenKarten breit (Owner 24.11.2026)', () => {
  it('Akkordeon: anfangs sind alle Themen zu, ein Klick auf den Titel klappt eines auf', () => {
    const { container } = render(<ThemenKarten themen={THEMEN} onFrage={() => {}} />)
    const koepfe = container.querySelectorAll('[data-thema-kopf]')
    expect(koepfe).toHaveLength(2)
    expect(container.querySelectorAll('[data-thema-offen="true"]')).toHaveLength(0)
    expect(koepfe[0].getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(koepfe[0])
    expect(koepfe[0].getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-thema-offen="true"]')?.textContent).toContain('Miteinander')
    fireEvent.click(koepfe[0])
    expect(container.querySelectorAll('[data-thema-offen="true"]')).toHaveLength(0)
  })
})

describe('WebsiteThemenRahmen', () => {
  const section = parseWebsiteSections('<!-- section layout=story -->\nx\n<!-- /section -->\n<!-- section layout=topics kicker="Inhalte" -->\n## Was hier drin steckt\n<!-- /section -->')[1]

  it('ohne Kinder: Markdown der Sektion und Hinweis fuer die Vorschau', () => {
    const { container } = render(<WebsiteThemenRahmen section={section} headingCase="none" />)
    expect(screen.getByText('Inhalte')).toBeTruthy()
    expect(screen.getByText('Was hier drin steckt')).toBeTruthy()
    expect(container.querySelector('[data-themen-vorschau]')?.textContent).toBe('website.story.themenVorschauHinweis')
  })

  it('mit Kindern: die Kinder statt des Hinweises', () => {
    const { container } = render(<WebsiteThemenRahmen section={section}><p>Karten</p></WebsiteThemenRahmen>)
    expect(screen.getByText('Karten')).toBeTruthy()
    expect(container.querySelector('[data-themen-vorschau]')).toBeNull()
  })
})
