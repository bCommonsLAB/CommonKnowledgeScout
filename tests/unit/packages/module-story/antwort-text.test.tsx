// @vitest-environment jsdom

/**
 * `AntwortText` (D6b): Zitatmarken ①… als Anker mit Titel aus den Belegen
 * (Dokument und Zahl der Textstellen); Klick scrollt zur Belegkarte statt die
 * Adresse zu aendern; ohne Karte im DOM (Quellen zu, D11b) bittet sie den
 * Gastgeber per Ereignis (D12e). `mitMarkenTiteln` arbeitet rein auf dem HTML.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { AntwortText, mitMarkenTiteln } from '@ks/module-story/react'
import { STORY_BELEG_ZEIGEN_EVENT } from '@ks/contracts'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join(',')}` : key),
    locale: 'de',
  }),
}))

afterEach(cleanup)

const belege = [
  { number: 1, fileId: 'f-a', fileName: 'Radwege.md', description: 'Radwege', passages: [{ excerpt: 'a' }, { excerpt: 'b', page: 3 }] },
  { number: 2, fileId: 'f-b', description: 'Ohne Namen' },
]

describe('mitMarkenTiteln', () => {
  it('haengt Titel und data-beleg an die Marken-Anker; unbekannte Nummern bleiben ohne Titel', () => {
    const html = '<p>x <a href="#beleg-1">①</a> <a href="#beleg-7">⑦</a> <a href="https://x">y</a></p>'
    const out = mitMarkenTiteln(html, belege, (b) => `${b.fileName ?? b.description} "<ok>"`)
    expect(out).toContain('<a href="#beleg-1" data-beleg="1" title="Radwege.md &quot;&lt;ok&gt;&quot;">①</a>')
    expect(out).toContain('<a href="#beleg-7" data-beleg="7">⑦</a>')
    expect(out).toContain('<a href="https://x">y</a>')
  })
})

describe('AntwortText', () => {
  it('rendert Markdown mit Marken und Titeln; ohne Textstellen nur der Dokumentname', () => {
    const { container } = render(<AntwortText text={'Erstens [1], zweitens [2].'} belege={belege} />)
    const marken = container.querySelectorAll('a[data-beleg]')
    expect(marken).toHaveLength(2)
    expect(marken[0].textContent).toBe('①')
    expect(marken[0].getAttribute('title')).toBe('story.zitat.marke:Radwege.md,story.beleg.passages.many:2')
    expect(marken[1].getAttribute('title')).toBe('Ohne Namen')
  })

  it('Klick auf die Marke scrollt zur Karte und laesst die Adresse in Ruhe; ohne Karte bittet sie den Gastgeber (D12e)', () => {
    const karte = document.createElement('li')
    karte.id = 'beleg-1'
    karte.scrollIntoView = vi.fn()
    document.body.appendChild(karte)
    const zeigen = vi.fn()
    window.addEventListener(STORY_BELEG_ZEIGEN_EVENT, zeigen)
    const { container } = render(<AntwortText text={'Siehe [1] und [2].'} belege={belege} />)
    const marken = container.querySelectorAll('a[data-beleg]')
    const klick = fireEvent.click(marken[0])
    expect(klick).toBe(false) // preventDefault — kein Sprung ueber die Adresse
    expect(karte.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(zeigen).not.toHaveBeenCalled()
    fireEvent.click(marken[1])
    expect(zeigen).toHaveBeenCalledTimes(1)
    expect((zeigen.mock.calls[0][0] as CustomEvent<{ marke: string }>).detail).toEqual({ marke: '2' })
    expect(window.location.hash).toBe('')
    karte.remove()
    window.removeEventListener(STORY_BELEG_ZEIGEN_EVENT, zeigen)
  })
})
