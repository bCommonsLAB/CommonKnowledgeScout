/**
 * Welle J4: PDF-Anhaenge aus den Quellen einer Sammeldatei und das
 * Umschreiben der Markdown-Links — `src/lib/ingestion/anhaenge-aus-quellen.ts`.
 */

import { describe, expect, it } from 'vitest'
import { anhaengeAusQuellen, ersetzePdfLinks } from '@/lib/ingestion/anhaenge-aus-quellen'
import { ordneQuellen, type Fragment, type QuellenTwin } from '@/lib/ingestion/quellen-fragmente'

function seiten(n: number): Fragment[] {
  return Array.from({ length: n }, (_, i) => ({ name: `preview_${i + 1}.jpeg`, url: `https://b/${i + 1}`, variant: 'thumbnail', pageNumber: i + 1 }))
}

const eigener: QuellenTwin = { sourceId: 'sammel', sourceName: 'Vortrag.md', fragments: [], eigener: true }

describe('anhaengeAusQuellen', () => {
  it('ordnet Folien, Unterlagen, Flyer — Audio und eigener Twin bleiben draussen', () => {
    const quellen = ordneQuellen(eigener, [
      { sourceId: 'flyer', sourceName: 'Einladung.pdf', fragments: seiten(2), eigener: false },
      { sourceId: 'audio', sourceName: 'Vortrag.mp3', fragments: [], eigener: false },
      { sourceId: 'unterlagen', sourceName: 'Handout.pdf', fragments: [], eigener: false },
      { sourceId: 'folien', sourceName: 'Folien.pdf', fragments: seiten(30), eigener: false },
    ])
    expect(anhaengeAusQuellen(quellen)).toEqual([
      { sourceId: 'folien', name: 'Folien.pdf' },
      { sourceId: 'unterlagen', name: 'Handout.pdf' },
      { sourceId: 'flyer', name: 'Einladung.pdf' },
    ])
  })

  it('liefert eine leere Liste ohne PDF-Quellen', () => {
    expect(anhaengeAusQuellen(ordneQuellen(eigener, [{ sourceId: 'a', sourceName: 'x.mp3', fragments: [], eigener: false }]))).toEqual([])
  })
})

describe('ersetzePdfLinks', () => {
  const adressen = new Map([
    ['Einladung.pdf', 'https://blob/sessions/x/Einladung.pdf'],
    ['Folien Tag 1.pdf', 'https://blob/sessions/x/Folien%20Tag%201.pdf'],
  ])

  it('schreibt Links auf den Dateinamen um, auch mit ./ und URL-kodierten Leerzeichen', () => {
    const md = 'Siehe [Flyer](Einladung.pdf) und [Folien](./Folien%20Tag%201.pdf "Titel") sowie [extern](https://x.y/Einladung.pdf).'
    const r = ersetzePdfLinks(md, adressen)
    expect(r.ersetzt).toBe(2)
    expect(r.markdown).toBe(
      'Siehe [Flyer](https://blob/sessions/x/Einladung.pdf) und [Folien](https://blob/sessions/x/Folien%20Tag%201.pdf "Titel") sowie [extern](https://x.y/Einladung.pdf).',
    )
  })

  it('laesst Text ohne passende Links unveraendert und ignoriert Adressen, die keine URL sind', () => {
    const md = '[a](Andere.pdf) ![bild](preview_001.jpg)'
    expect(ersetzePdfLinks(md, adressen)).toEqual({ markdown: md, ersetzt: 0 })
    expect(ersetzePdfLinks('[x](Einladung.pdf)', new Map([['Einladung.pdf', 'Einladung.pdf']])).ersetzt).toBe(0)
  })
})

describe('Reihenfolge der Sammeldatei (attachments_order: source_files)', () => {
  it('ordnet nach _source_files statt nach Seitenzahl; Unbekanntes ans Ende', async () => {
    const { anhangReihenfolge, quelldateienAusMeta } = await import('@/lib/ingestion/anhaenge-aus-quellen')
    const quellen = ordneQuellen(eigener, [
      { sourceId: 'c', sourceName: '28 C - Statement.pdf', fragments: seiten(9), eigener: false },
      { sourceId: 'x', sourceName: 'Nachtrag.pdf', fragments: seiten(1), eigener: false },
      { sourceId: 'a', sourceName: '01 A - Statement.pdf', fragments: seiten(2), eigener: false },
      { sourceId: 'b', sourceName: '04 B - Statement.pdf', fragments: seiten(5), eigener: false },
    ])
    const meta = { attachments_order: 'source_files', _source_files: '["Programm.md","01 A - Statement.pdf","04 B - Statement.pdf","28 c - statement.pdf"]' }
    expect(anhangReihenfolge(meta)).toBe('source_files')
    expect(anhaengeAusQuellen(quellen, quelldateienAusMeta(meta)).map((a) => a.sourceId)).toEqual(['a', 'b', 'c', 'x'])
    expect(anhaengeAusQuellen(quellen).map((a) => a.sourceId)).toEqual(['c', 'b', 'a', 'x'])
  })

  it('kennt nur zwei Werte und verlangt die Quellenliste', async () => {
    const { anhangReihenfolge, quelldateienAusMeta } = await import('@/lib/ingestion/anhaenge-aus-quellen')
    expect(anhangReihenfolge({})).toBe('slides_first')
    expect(() => anhangReihenfolge({ attachments_order: 'alphabetisch' })).toThrow('unbekannt')
    expect(() => quelldateienAusMeta({})).toThrow('nennt keine _source_files')
    expect(quelldateienAusMeta({ _source_files: ['a.pdf'] })).toEqual(['a.pdf'])
  })
})
