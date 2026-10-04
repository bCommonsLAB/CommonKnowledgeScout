import { describe, it, expect } from 'vitest'
import { dokumentNummern, zitatmarke, zitatmarkenImText } from '@ks/util'

describe('zitatmarke', () => {
  it('Kreiszahlen 1 bis 20, darueber in Klammern', () => {
    expect(zitatmarke(1)).toBe('①')
    expect(zitatmarke(20)).toBe('⑳')
    expect(zitatmarke(21)).toBe('(21)')
    expect(zitatmarke(0)).toBe('(0)')
  })
})

describe('dokumentNummern (D12k)', () => {
  it('Antworten seit D7 (eine Nummer je Dokument): Identitaet', () => {
    const map = dokumentNummern([
      { number: 1, fileId: 'a' },
      { number: 2, fileId: 'b' },
    ])
    expect([...map.entries()]).toEqual([[1, 1], [2, 2]])
  })

  it('alte Antworten (Nummer je Textstelle): jede Stelle faellt auf ihr Dokument, Reihenfolge der ersten Nennung', () => {
    const map = dokumentNummern([
      { number: 3, fileId: 'b' },
      { number: 1, fileId: 'a' },
      { number: 2, fileId: 'a' },
      { number: 56, fileId: 'c' },
      { number: 4, fileId: 'b' },
    ])
    expect(map.get(1)).toBe(1)
    expect(map.get(2)).toBe(1)
    expect(map.get(3)).toBe(2)
    expect(map.get(4)).toBe(2)
    expect(map.get(56)).toBe(3)
    expect(map.get(7)).toBeUndefined()
  })
})

describe('zitatmarkenImText', () => {
  it('macht aus [n] einen Anker auf die Belegkarte; die Zahl ist der Text der Marke', () => {
    expect(zitatmarkenImText('Radwege helfen [1] [3].')).toBe('Radwege helfen [1](#beleg-1) [3](#beleg-3).')
  })

  it('laesst Markdown-Links und Text ohne Marken in Ruhe', () => {
    expect(zitatmarkenImText('Siehe [2](https://x) und [Titel](#a).')).toBe('Siehe [2](https://x) und [Titel](#a).')
    expect(zitatmarkenImText('Keine Marke.')).toBe('Keine Marke.')
  })

  it('D12k: schreibt die Dokumentnummer und laesst von Marken desselben Dokuments hintereinander eine', () => {
    const nummern = new Map([
      [14, 11],
      [15, 11],
      [56, 12],
      [3, 2],
    ])
    const nummerFuer = (n: number) => nummern.get(n)
    expect(zitatmarkenImText('Bahn [14] [15]. Verkehr [56] und [3], [14].', nummerFuer)).toBe(
      'Bahn [11](#beleg-11). Verkehr [12](#beleg-12) und [2](#beleg-2) [11](#beleg-11).',
    )
    // Zwei verschiedene Dokumente hintereinander bleiben zwei Marken.
    expect(zitatmarkenImText('A [3] [56].', nummerFuer)).toBe('A [2](#beleg-2) [12](#beleg-12).')
  })

  it('unbekannte Marke (keine Referenz dazu) behaelt ihre Nummer', () => {
    expect(zitatmarkenImText('Siehe [9].', () => undefined)).toBe('Siehe [9](#beleg-9).')
  })
})
