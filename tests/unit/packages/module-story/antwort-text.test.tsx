// @vitest-environment jsdom

/**
 * `AntwortText` (D6b, D12k): Zitatmarken als Anker mit der Dokumentnummer,
 * Klasse der Marke und Titel aus den Belegen (Dokumenttitel und Zahl der
 * Textstellen); alte Antworten mit Nummer je Textstelle werden je Dokument
 * nummeriert. Klick scrollt zur Belegkarte statt die Adresse zu aendern; ohne
 * Karte im DOM (Quellen zu, D11b) bittet sie den Gastgeber per Ereignis
 * (D12e). `mitMarkenTiteln` arbeitet rein auf dem HTML.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { AntwortText, belegeNachDokument, belegTitel, mitMarkenTiteln } from '@ks/module-story/react'
import { STORY_BELEG_ZEIGEN_EVENT } from '@ks/contracts'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join(',')}` : key),
    locale: 'de',
  }),
}))

afterEach(cleanup)

const belege = [
  { number: 1, fileId: 'f-a', fileName: 'Radwege.md', title: 'Radwege ausbauen', description: 'Radwege', passages: [{ excerpt: 'a' }, { excerpt: 'b', page: 3 }] },
  { number: 2, fileId: 'f-b', description: 'Ohne Namen' },
]

describe('mitMarkenTiteln', () => {
  it('ersetzt den Anker-Kopf durch Klasse, data-beleg und Titel; ohne Titel kein title-Attribut', () => {
    const html = '<p>x <a href="#beleg-1" class="text-primary">1</a> <a href="#beleg-7">7</a> <a href="https://x">y</a></p>'
    const out = mitMarkenTiteln(html, (k) => (k === 1 ? 'Radwege "<ok>"' : undefined), 'marke')
    expect(out).toContain('<a href="#beleg-1" data-beleg="1" class="marke" title="Radwege &quot;&lt;ok&gt;&quot;">1</a>')
    expect(out).toContain('<a href="#beleg-7" data-beleg="7" class="marke">7</a>')
    expect(out).toContain('<a href="https://x">y</a>')
  })
})

describe('belegeNachDokument / belegTitel', () => {
  it('gruppiert alte Antworten je Dokument; Titel vor Dateiname vor Begruendung', () => {
    const alt = [
      { number: 1, fileId: 'f-a', fileName: 'a.md', description: 'eins' },
      { number: 2, fileId: 'f-b', description: 'zwei' },
      { number: 3, fileId: 'f-a', fileName: 'a.md', description: 'drei' },
    ]
    const map = belegeNachDokument(alt)
    expect([...map.keys()]).toEqual([1, 2])
    expect(map.get(1)?.map((b) => b.number)).toEqual([1, 3])
    expect(belegTitel(belege[0])).toBe('Radwege ausbauen')
    expect(belegTitel(alt[0])).toBe('a.md')
    expect(belegTitel(alt[1])).toBe('zwei')
  })
})

describe('AntwortText', () => {
  it('rendert Markdown mit Marken (Zahl, Klasse) und Titeln; ohne Textstellen nur der Dokumenttitel', () => {
    const { container } = render(<AntwortText text={'Erstens [1], zweitens [2].'} belege={belege} />)
    const marken = container.querySelectorAll('a[data-beleg]')
    expect(marken).toHaveLength(2)
    expect(marken[0].textContent).toBe('1')
    expect(marken[0].className).toContain('rounded-full')
    expect(marken[0].getAttribute('title')).toBe('story.zitat.marke:Radwege ausbauen,story.beleg.passages.many:2')
    expect(marken[1].getAttribute('title')).toBe('Ohne Namen')
  })

  it('D12k: alte Antwort mit Nummer je Textstelle — Marken je Dokument, keine Doppelmarke, Textstellen summiert', () => {
    const alt = [
      { number: 1, fileId: 'f-a', title: 'Bahn', description: 'x', passages: [{ excerpt: 'a' }] },
      { number: 2, fileId: 'f-a', title: 'Bahn', description: 'y', passages: [{ excerpt: 'b' }] },
      { number: 3, fileId: 'f-b', title: 'Bus', description: 'z' },
    ]
    const { container } = render(<AntwortText text={'Bahn [1] [2], Bus [3], wieder Bahn [2].'} belege={alt} />)
    const marken = Array.from(container.querySelectorAll('a[data-beleg]'))
    expect(marken.map((m) => m.getAttribute('data-beleg'))).toEqual(['1', '2', '1'])
    expect(marken.map((m) => m.textContent)).toEqual(['1', '2', '1'])
    expect(marken[0].getAttribute('title')).toBe('story.zitat.marke:Bahn,story.beleg.passages.many:2')
    expect(marken[1].getAttribute('title')).toBe('Bus')
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
