// @vitest-environment jsdom

/**
 * Mitte des Story-Modus (D1): Kopf des Ganzen mit Themenkarten, Themenseite
 * mit Fragen als Knoepfen. Konfig-Bloecke fallen weg, wenn das Feld fehlt.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { StoryTopicsData } from '@ks/contracts'
import { StoryUebersicht, StoryThema, zaehlerText } from '@ks/module-story/react'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
    locale: 'de',
  }),
}))

const gliederung: StoryTopicsData = {
  id: 'lib', title: 'Themen der Sammlung', tagline: '', intro: 'Drei Zeilen Einleitung.',
  topics: [
    { id: 'verkehr', title: 'Verkehr', summary: 'Wege und Wagen.', questions: [{ id: 'q1', text: 'Welche Massnahmen gibt es zum Verkehr?' }] },
    { id: 'heizen', title: 'Heizen', questions: [{ id: 'q2', text: 'Wie heizen wir morgen?' }, { id: 'q3', text: 'Was kostet das?' }] },
  ],
}

afterEach(cleanup)

describe('zaehlerText', () => {
  it('nimmt Einzahl bei 1, sonst Mehrzahl mit Zahl', () => {
    const t = (key: string, params?: Record<string, string | number>) => (params ? `${key}:${params.count}` : key)
    expect(zaehlerText(t, 'documents', 1)).toBe('story.count.documents.one')
    expect(zaehlerText(t, 'documents', 12)).toBe('story.count.documents.many:12')
  })
})

describe('StoryUebersicht', () => {
  it('zeigt Kopf, Zaehler und eine Karte je Thema; Klick waehlt das Thema', () => {
    const onThemaWaehlen = vi.fn()
    render(
      <StoryUebersicht
        kopf={{ titel: 'Klimamassnahmen', beschreibung: 'Was die Region plant.' }}
        gliederung={gliederung}
        dokumente={42}
        onThemaWaehlen={onThemaWaehlen}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Klimamassnahmen')
    expect(screen.getByText('Was die Region plant.')).toBeTruthy()
    expect(screen.getByText('story.count.documents.many:42')).toBeTruthy()
    expect(screen.getByText('story.count.topics.many:2')).toBeTruthy()
    expect(screen.getByText('story.count.questions.many:3')).toBeTruthy()
    // Karten: Titel der Gliederung als Ueberschrift, je Thema ein Satz und „n Fragen"
    expect(screen.getByText('Themen der Sammlung')).toBeTruthy()
    expect(screen.getByText('Wege und Wagen.')).toBeTruthy()
    expect(screen.getByText('story.count.questions.one')).toBeTruthy()
    // Fragen stehen NICHT in der Uebersicht
    expect(screen.queryByText('Wie heizen wir morgen?')).toBeNull()

    fireEvent.click(screen.getByText('Heizen'))
    expect(onThemaWaehlen).toHaveBeenCalledWith('heizen')
  })

  it('ohne Beschreibung kein Block; ohne Gliederung nur Kopf, Dokumente und Status', () => {
    render(
      <StoryUebersicht
        kopf={{ titel: 'Klimamassnahmen' }}
        gliederung={null}
        dokumente={1}
        onThemaWaehlen={() => {}}
        status={<div>rechnet…</div>}
      />,
    )
    expect(screen.getByText('rechnet…')).toBeTruthy()
    expect(screen.getByText('story.count.documents.one')).toBeTruthy()
    expect(screen.queryByText(/story.count.topics/)).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('Konfig-Texte gehen vor den Texten der Gliederung', () => {
    render(
      <StoryUebersicht
        kopf={{ titel: 'K' }}
        gliederung={gliederung}
        dokumente={3}
        themenTitel="Unsere Themen"
        themenIntro="Eigene Einleitung."
        onThemaWaehlen={() => {}}
      />,
    )
    expect(screen.getByText('Unsere Themen')).toBeTruthy()
    expect(screen.getByText('Eigene Einleitung.')).toBeTruthy()
    expect(screen.queryByText('Themen der Sammlung')).toBeNull()
  })
})

describe('StoryThema', () => {
  it('zeigt Titel, Zaehler und Fragen als Knoepfe; Zurueck fuehrt zur Uebersicht', () => {
    const onFrageWaehlen = vi.fn()
    const onZurueck = vi.fn()
    render(<StoryThema thema={gliederung.topics[1]} onFrageWaehlen={onFrageWaehlen} onZurueck={onZurueck} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Heizen')
    expect(screen.getByText('story.count.questions.many:2')).toBeTruthy()
    fireEvent.click(screen.getByText('Was kostet das?'))
    expect(onFrageWaehlen).toHaveBeenCalledWith({ id: 'q3', text: 'Was kostet das?' })
    fireEvent.click(screen.getByText('story.back'))
    expect(onZurueck).toHaveBeenCalledTimes(1)
  })
})
