/**
 * Zitatmarken je Dokument (D7): Nummern in Reihenfolge der ersten Nennung,
 * Textstellen als passages, Seite nur wo vorhanden, Ausschnitt gekuerzt.
 */
import { describe, it, expect } from 'vitest'
import { belegeAusGruppen, dokumenteNummerieren, excerpt, nummerFuerQuelle } from '@/lib/chat/common/zitatmarken'
import type { RetrievedSource } from '@/types/retriever'

const q = (id: string, fileId: string | undefined, text: string, extra: Partial<RetrievedSource> = {}): RetrievedSource => ({ id, fileId, text, ...extra })
const sources: RetrievedSource[] = [
  q('a-0', 'a', 'Radwege ausbauen, erster Abschnitt.', { fileName: 'Radwege.md', chunkIndex: 0, page: 3 }),
  q('b-4', 'b', 'Fernwaerme fuer die Stadt.', { fileName: 'Heizen.md', chunkIndex: 4 }),
  q('a-2', 'a', 'Kosten der Radwege.', { chunkIndex: 2, page: 5 }),
  q('c-1', undefined, 'Ohne fileId, aus der Kennung.', { chunkIndex: 1 }),
]

describe('dokumenteNummerieren', () => {
  it('eine Nummer je Dokument in Reihenfolge der ersten Nennung', () => {
    const g = dokumenteNummerieren(sources)
    expect(g.map((x) => [x.nummer, x.fileId, x.sources.length])).toEqual([[1, 'a', 2], [2, 'b', 1], [3, 'c', 1]])
    expect(g[0].fileName).toBe('Radwege.md')
    expect(nummerFuerQuelle(g, sources[2])).toBe(1)
    expect(nummerFuerQuelle(g, q('z-0', 'z', ''))).toBeUndefined()
  })
})

describe('excerpt', () => {
  it('kuerzt an der Wortgrenze mit Auslassung und glaettet Umbrueche', () => {
    expect(excerpt('Zeile eins\n\nZeile   zwei')).toBe('Zeile eins Zeile zwei')
    const lang = excerpt('Wort '.repeat(60))
    expect(lang.length).toBeLessThanOrEqual(161)
    expect(lang.endsWith('…')).toBe(true)
  })
})

describe('belegeAusGruppen', () => {
  const beschreibung = (s: RetrievedSource) => `Stelle ${s.chunkIndex}`

  it('ein Beleg je Dokument mit Textstellen; Seite nur, wo sie da ist', () => {
    const belege = belegeAusGruppen(dokumenteNummerieren(sources), [], beschreibung)
    expect(belege.map((b) => b.number)).toEqual([1, 2, 3])
    expect(belege[0]).toMatchObject({ fileId: 'a', fileName: 'Radwege.md', description: 'Stelle 0; Stelle 2' })
    expect(belege[0].passages).toEqual([
      { chunkIndex: 0, page: 3, excerpt: 'Radwege ausbauen, erster Abschnitt.' },
      { chunkIndex: 2, page: 5, excerpt: 'Kosten der Radwege.' },
    ])
    expect(belege[1].passages?.[0]).toEqual({ chunkIndex: 4, excerpt: 'Fernwaerme fuer die Stadt.' })
    expect('page' in (belege[1].passages?.[0] ?? {})).toBe(false)
  })

  it('nur die zitierten Dokumente, wenn das Modell welche nennt', () => {
    const belege = belegeAusGruppen(dokumenteNummerieren(sources), [2], beschreibung)
    expect(belege.map((b) => b.number)).toEqual([2])
  })
})
