/**
 * Welle A — Pruefregeln von `bestand_pruefen`: doppelte Kennung, Woerterbuch,
 * Pflichtfelder, Twin-/Testordner; uebersprungene Regeln werden benannt.
 */
import { describe, it, expect } from 'vitest'
import { istTwinOderTestPfad, pruefeBestand, type BestandEintrag } from '@/lib/mcp/bestand-pruefung'
import type { FacetDef } from '@/lib/chat/dynamic-facets'

const STATUS: FacetDef = {
  metaKey: 'lv_bewertung', type: 'string', multi: false, visible: true,
  werte: [{ wert: 'beschlossen', label: 'beschlossen' }, { wert: 'nicht_umsetzbar', label: 'nicht umsetzbar' }],
}
const OHNE: FacetDef = { metaKey: 'tags', type: 'string[]', multi: true, visible: true }

function eintrag(teil: Partial<BestandEintrag> & { sourceId: string }): BestandEintrag {
  return { quelle: `${teil.sourceId}.md`, detailViewType: 'climateAction', felder: {}, pfad: 'Massnahmen', ...teil }
}

const PFLICHT = (typ: string): string[] => (typ === 'climateAction' ? ['title', 'category'] : [])

describe('istTwinOderTestPfad', () => {
  it('erkennt Twin-Ordner (_…) und test-Ordner in jeder Tiefe', () => {
    expect(istTwinOderTestPfad('Klima/_Bericht 2026/Teil')).toBe(true)
    expect(istTwinOderTestPfad('Klima/Test')).toBe(true)
    expect(istTwinOderTestPfad('Klima/Massnahmen')).toBe(false)
  })
})

describe('pruefeBestand', () => {
  it('meldet doppelte Kennungen fuer jeden Beteiligten und nennt die anderen', () => {
    const { befunde, zaehler } = pruefeBestand(
      [eintrag({ sourceId: 'a', felder: { massnahme_nr: 38, title: 't', category: 'c' } }),
       eintrag({ sourceId: 'b', felder: { massnahme_nr: '38', title: 't', category: 'c' } }),
       eintrag({ sourceId: 'c', felder: { massnahme_nr: 39, title: 't', category: 'c' } })],
      { defs: [OHNE], kennungsfeld: 'massnahme_nr', standardTyp: 'climateAction', pflichtfelder: PFLICHT },
    )
    expect(zaehler.doppelte_kennung).toBe(2)
    expect(befunde.map((b) => b.sourceId)).toEqual(['a', 'b'])
    expect(befunde[0].detail).toContain('b.md')
  })

  it('ueberspringt die Dublettenpruefung ohne kennungsfeld und sagt es', () => {
    const { uebersprungen, zaehler } = pruefeBestand(
      [eintrag({ sourceId: 'a', felder: { massnahme_nr: 1, title: 't', category: 'c' } }),
       eintrag({ sourceId: 'b', felder: { massnahme_nr: 1, title: 't', category: 'c' } })],
      { defs: [OHNE], standardTyp: 'climateAction', pflichtfelder: PFLICHT },
    )
    expect(zaehler.doppelte_kennung).toBe(0)
    expect(uebersprungen.some((u) => u.startsWith('doppelte_kennung'))).toBe(true)
  })

  it('meldet Werte ausserhalb des Woerterbuchs, Werte darin nicht', () => {
    const { befunde } = pruefeBestand(
      [eintrag({ sourceId: 'a', felder: { lv_bewertung: 'Nicht umsetzbar (Freitext)', title: 't', category: 'c' } }),
       eintrag({ sourceId: 'b', felder: { lv_bewertung: 'beschlossen', title: 't', category: 'c' } })],
      { defs: [STATUS], standardTyp: 'climateAction', pflichtfelder: PFLICHT },
    )
    expect(befunde).toHaveLength(1)
    expect(befunde[0]).toMatchObject({ regel: 'wert_ausserhalb_woerterbuch', sourceId: 'a' })
    expect(befunde[0].detail).toContain('beschlossen, nicht_umsetzbar')
  })

  it('nennt, wenn keine Facette ein Woerterbuch traegt', () => {
    const { uebersprungen } = pruefeBestand([], { defs: [OHNE], standardTyp: 'book', pflichtfelder: PFLICHT })
    expect(uebersprungen.some((u) => u.startsWith('wert_ausserhalb_woerterbuch'))).toBe(true)
  })

  it('prueft Pflichtfelder gegen den Typ des Eintrags, sonst gegen den Standardtyp', () => {
    const { befunde } = pruefeBestand(
      [eintrag({ sourceId: 'a', felder: { title: 't', category: '' } }),
       eintrag({ sourceId: 'b', detailViewType: null, felder: { title: 't' } }),
       eintrag({ sourceId: 'c', detailViewType: 'book', felder: {} })],
      { defs: [], standardTyp: 'climateAction', pflichtfelder: PFLICHT },
    )
    expect(befunde.map((b) => [b.sourceId, b.detail])).toEqual([
      ['a', 'Typ climateAction: category fehlt'],
      ['b', 'Typ climateAction: category fehlt'],
    ])
  })

  it('meldet Twin-/Testordner und zaehlt Eintraege ohne Pfad als uebersprungen', () => {
    const { befunde, uebersprungen } = pruefeBestand(
      [eintrag({ sourceId: 'a', pfad: 'Klima/_Massnahme 12', felder: { title: 't', category: 'c' } }),
       eintrag({ sourceId: 'b', pfad: 'Klima/test', felder: { title: 't', category: 'c' } }),
       eintrag({ sourceId: 'c', pfad: null, felder: { title: 't', category: 'c' } })],
      { defs: [], standardTyp: 'climateAction', pflichtfelder: PFLICHT },
    )
    expect(befunde.filter((b) => b.regel === 'twin_oder_testordner').map((b) => b.sourceId)).toEqual(['a', 'b'])
    expect(uebersprungen.some((u) => u.includes('1 Eintrag'))).toBe(true)
  })
})
