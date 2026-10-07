import { describe, it, expect } from 'vitest'
import { normalizeChatConfig } from '@/lib/chat/config'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { facetWerteSchema, findeFacetWert } from '@/lib/chat/facet-werte'
import type { Library } from '@/types/library'

/**
 * Plan story-status-modalitaet, m1: Bedeutungs-Wörterbuch (`werte`) und
 * `ingestKontext` am Facetten-Schema. Beide Felder müssen die Server-
 * Normalisierung (Zod strippt Unbekanntes!) und parseFacetDefs überleben,
 * und ungültige Kombinationen müssen laut scheitern.
 */

const KLIMA_WERTE = [
  { wert: 'in_umsetzung', label: 'in Umsetzung', bedeutung: 'Laut Landesverwaltung in Umsetzung. Kein Urteil über Erfolg oder Umfang.', verboten: ['ist umgesetzt', 'gibt es seit'] },
  { wert: 'nicht_umsetzbar', label: 'nicht umsetzbar', bedeutung: 'Als nicht umsetzbar bewertet; wird nicht umgesetzt.' },
]

function libMitFacets(facets: unknown[]): Library {
  return {
    id: 'test-lib-werte',
    config: { chat: { gallery: { facets } } },
  } as unknown as Library
}

describe('Facetten: Bedeutungs-Wörterbuch und Ingest-Kontext (m1)', () => {
  it('werte und ingestKontext überleben normalizeChatConfig und parseFacetDefs', () => {
    const lib = libMitFacets([
      { metaKey: 'lv_bewertung', label: 'LV-Bewertung', type: 'string', multi: true, visible: true, ingestKontext: true, werte: KLIMA_WERTE },
      { metaKey: 'arbeitsgruppe', label: 'Arbeitsgruppe', type: 'string', multi: true, visible: true },
    ])

    const normalized = normalizeChatConfig(lib.config?.chat)
    const lv = normalized.gallery.facets.find((f) => f.metaKey === 'lv_bewertung')
    expect(lv?.ingestKontext).toBe(true)
    expect(lv?.werte).toEqual(KLIMA_WERTE)

    const defs = parseFacetDefs(lib)
    const byKey = Object.fromEntries(defs.map((d) => [d.metaKey, d]))
    expect(byKey.lv_bewertung.ingestKontext).toBe(true)
    expect(byKey.lv_bewertung.werte).toEqual(KLIMA_WERTE)
    // Facette ohne Wörterbuch trägt die Felder gar nicht (kein leeres Array, kein false).
    expect(byKey.arbeitsgruppe.ingestKontext).toBeUndefined()
    expect(byKey.arbeitsgruppe.werte).toBeUndefined()
    // Basis-Facetten bleiben unberührt.
    expect(byKey.tags.werte).toBeUndefined()
  })

  it('Wörterbuch an einer Zahl-Facette ist ein Konfigurationsfehler, kein stilles Ignorieren', () => {
    const cfg = { gallery: { facets: [
      { metaKey: 'kosten_eur', type: 'number', werte: [{ wert: '1', label: 'eins' }] },
    ] } }
    expect(() => normalizeChatConfig(cfg)).toThrow(/string oder string\[\]/)
  })

  it('Wörterbuch an string[] ist erlaubt', () => {
    const cfg = { gallery: { facets: [
      { metaKey: 'tags', type: 'string[]', werte: [{ wert: 'mobilitaet', label: 'Mobilität' }] },
    ] } }
    expect(() => normalizeChatConfig(cfg)).not.toThrow()
  })

  it('doppelte Werte im Wörterbuch werden abgelehnt', () => {
    const ergebnis = facetWerteSchema.safeParse([
      { wert: 'a', label: 'A' },
      { wert: 'a', label: 'A nochmal' },
    ])
    expect(ergebnis.success).toBe(false)
    if (!ergebnis.success) {
      expect(ergebnis.error.issues[0].message).toMatch(/doppelt/)
      expect(ergebnis.error.issues[0].path).toEqual([1, 'wert'])
    }
  })

  it('leerer Wert oder leeres Label werden abgelehnt', () => {
    expect(facetWerteSchema.safeParse([{ wert: '  ', label: 'X' }]).success).toBe(false)
    expect(facetWerteSchema.safeParse([{ wert: 'x', label: '' }]).success).toBe(false)
  })

  it('findeFacetWert liefert den Eintrag oder undefined, rät nie', () => {
    expect(findeFacetWert(KLIMA_WERTE, 'nicht_umsetzbar')?.label).toBe('nicht umsetzbar')
    expect(findeFacetWert(KLIMA_WERTE, 'unbekannt')).toBeUndefined()
    expect(findeFacetWert(KLIMA_WERTE, 42)).toBeUndefined()
    expect(findeFacetWert(undefined, 'in_umsetzung')).toBeUndefined()
  })
})
