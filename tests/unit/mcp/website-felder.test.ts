/**
 * B2 — Feldregeln von `dokument_felder_setzen`: Sperrliste, Pflichtfelder,
 * Listen mit normalisierten Dubletten, nur echte Aenderungen zaehlen.
 */
import { describe, it, expect } from 'vitest'
import { ersetzeText, wendeFelderAn } from '@/lib/mcp/website-felder'

const META = { title: 'Massnahme 12', detailViewType: 'climateAction', tags: ['Energie'], category: 'Energie', summary: 'S', language: 'de', targetLanguage: 'de' }

describe('wendeFelderAn', () => {
  it('ergaenzt ein Tag und meldet nur das geaenderte Feld', () => {
    const { meta, geaendert } = wendeFelderAn(META, { listen: { tags: ['fokus'] } }, 'climateAction')
    expect(meta.tags).toEqual(['Energie', 'fokus'])
    expect(geaendert).toEqual({ tags: ['Energie', 'fokus'] })
  })

  it('erkennt Dubletten normalisiert (Gross/Klein, Leerzeichen) und aendert dann nichts', () => {
    const { geaendert } = wendeFelderAn(META, { listen: { tags: [' energie '] } }, 'climateAction')
    expect(geaendert).toEqual({})
  })

  it('entfernt Listeneintraege normalisiert', () => {
    const { meta } = wendeFelderAn({ ...META, tags: ['Energie', 'fokus'] }, { entfernen: { tags: ['FOKUS'] } }, 'climateAction')
    expect(meta.tags).toEqual(['Energie'])
  })

  it('legt ein fehlendes Listenfeld an', () => {
    const { meta } = wendeFelderAn({ title: 'x' }, { listen: { tags: ['fokus'] } }, null)
    expect(meta.tags).toEqual(['fokus'])
  })

  it('setzt Skalare und laesst gleiche Werte unveraendert', () => {
    const { geaendert } = wendeFelderAn(META, { felder: { menu_order: 3, summary: 'S' } }, 'climateAction')
    expect(geaendert).toEqual({ menu_order: 3 })
  })

  it('weist gesperrte Pipeline-Felder ab', () => {
    expect(() => wendeFelderAn(META, { felder: { prioritaets_index: 99 } }, 'climateAction')).toThrow(/gesperrt/)
  })

  it('weist Pflichtfelder des Typs ab', () => {
    expect(() => wendeFelderAn(META, { felder: { category: 'Mobilitaet' } }, 'climateAction')).toThrow(/Pflichtfeld "category"/)
  })

  it('weist verschachtelte oder unflache Keys ab', () => {
    expect(() => wendeFelderAn(META, { felder: { 'a.b': 1 } }, null)).toThrow(/flacher/)
  })
})

// 2.77.0 — Befund 20.11.2026: das Modell verkuerzt lange Adressen; der Link im Seitentext bleibt kaputt.
describe('ersetzeText', () => {
  const KURZ = 'https://fosdem.org/2025/schedule/event/x-devroom/'
  const RICHTIG = 'https://fosdem.org/2025/schedule/event/x-devroom-/'
  const BODY = `## Talk\n\n## Links\n- [Talk page at FOSDEM](${KURZ})\n- [Slides](${KURZ}slides.pdf)\n`
  const TALK = { title: 'Talk', detailViewType: 'session', links_md: `- [Talk page](${KURZ})`, source_url: RICHTIG, year: 2025 }

  it('ersetzt jede Fundstelle im Seitentext und in Text-Feldern', () => {
    const r = ersetzeText(TALK, BODY, [{ alt: KURZ, neu: RICHTIG }], null)
    expect(r.body).not.toContain(KURZ)
    expect(r.body.split(RICHTIG).length - 1).toBe(2)
    expect(r.geaendert).toEqual({ links_md: `- [Talk page](${RICHTIG})` })
    expect(r.textGeaendert).toBe(true)
    expect(r.nichtGefunden).toEqual([])
  })

  it('meldet eine Ersetzung ohne Treffer laut und aendert nichts', () => {
    const r = ersetzeText(TALK, BODY, [{ alt: 'gibt-es-nicht', neu: 'x' }], null)
    expect(r.nichtGefunden).toEqual(['gibt-es-nicht'])
    expect(r.textGeaendert).toBe(false)
    expect(r.geaendert).toEqual({})
  })

  it('laesst gesperrte und nicht-textliche Felder unberuehrt', () => {
    const r = ersetzeText({ ...TALK, docType: `Talk ${KURZ}` }, 'ohne', [{ alt: KURZ, neu: RICHTIG }], null)
    expect(r.meta.docType).toBe(`Talk ${KURZ}`)
    expect(r.meta.year).toBe(2025)
    expect(Object.keys(r.geaendert)).toEqual(['links_md'])
  })

  it('weist zu kurze und wirkungslose Ersetzungen ab', () => {
    expect(() => ersetzeText(TALK, BODY, [{ alt: 'ab', neu: 'x' }], null)).toThrow(/mindestens 3/)
    expect(() => ersetzeText(TALK, BODY, [{ alt: KURZ, neu: KURZ }], null)).toThrow(/gleich/)
  })

  it('weist einen Treffer in einem Pflichtfeld des Typs ab', () => {
    const massnahme = { ...META, category: 'Energie alt' }
    expect(() => ersetzeText(massnahme, 'x', [{ alt: 'Energie alt', neu: 'Energie neu' }], 'climateAction')).toThrow(/Pflichtfeld "category"/)
  })
})
