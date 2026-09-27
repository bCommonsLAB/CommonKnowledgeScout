/**
 * B2 — Feldregeln von `dokument_felder_setzen`: Sperrliste, Pflichtfelder,
 * Listen mit normalisierten Dubletten, nur echte Aenderungen zaehlen.
 */
import { describe, it, expect } from 'vitest'
import { wendeFelderAn } from '@/lib/mcp/website-felder'

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
