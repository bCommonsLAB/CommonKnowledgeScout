/**
 * Reihenfolge der Filterwerte (Owner 10.11.2026): Richtung je Facette, und
 * `sort`/`max`/`columns` ueberleben das Server-Schema — vorher verwarf Zod sie,
 * die Galerie sortierte jeden Filter aufsteigend nach Wert.
 */
import { describe, it, expect } from 'vitest'
import { ausSortierWahl, sortiereFacettenWerte, sortierWahlWert, standardRichtung, SORTIER_WAHLEN } from '@/lib/chat/facet-sortierung'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { validiereChatKonfiguration } from '@/lib/services/chat-config-validation'
import type { Library } from '@/types/library'

const JAHRE = [{ value: 2024, count: 120 }, { value: 2026, count: 160 }, { value: 2019, count: 80 }, { value: 2025, count: 160 }]
const TRACKS = [{ value: 'Legal', count: 3 }, { value: 'AI', count: 9 }, { value: 'Main', count: 9 }]

describe('sortiereFacettenWerte', () => {
  it('ohne Angaben wie bisher: Werte aufsteigend', () => {
    expect(sortiereFacettenWerte(JAHRE, { type: 'number' }).map((o) => o.value)).toEqual([2019, 2024, 2025, 2026])
    expect(sortiereFacettenWerte(TRACKS, {}).map((o) => o.value)).toEqual(['AI', 'Legal', 'Main'])
  })

  it('alpha + desc: der juengste Jahrgang steht oben; Zahlen als Zahlen, auch als Text gespeichert', () => {
    expect(sortiereFacettenWerte(JAHRE, { type: 'number', sort: 'alpha', sortDirection: 'desc' }).map((o) => o.value)).toEqual([2026, 2025, 2024, 2019])
    const gemischt = [{ value: '9', count: 1 }, { value: '10', count: 1 }, { value: '100', count: 1 }]
    expect(sortiereFacettenWerte(gemischt, { type: 'number' }).map((o) => o.value)).toEqual(['9', '10', '100'])
    expect(sortiereFacettenWerte(gemischt, { type: 'string' }).map((o) => o.value)).toEqual(['10', '100', '9'])
  })

  it('count: haeufigste zuerst (gewohnte Richtung), asc dreht um; Gleichstand immer nach Wert aufsteigend', () => {
    expect(sortiereFacettenWerte(TRACKS, { sort: 'count' }).map((o) => o.value)).toEqual(['AI', 'Main', 'Legal'])
    expect(sortiereFacettenWerte(TRACKS, { sort: 'count', sortDirection: 'asc' }).map((o) => o.value)).toEqual(['Legal', 'AI', 'Main'])
    expect(standardRichtung('count')).toBe('desc')
    expect(standardRichtung('alpha')).toBe('asc')
  })

  it('max kappt NACH dem Sortieren und veraendert die Eingabe nicht', () => {
    const vorher = JAHRE.map((o) => o.value)
    expect(sortiereFacettenWerte(JAHRE, { type: 'number', sortDirection: 'desc', max: 2 }).map((o) => o.value)).toEqual([2026, 2025])
    expect(JAHRE.map((o) => o.value)).toEqual(vorher)
  })
})

describe('Auswahl der Maske', () => {
  it('vier Kombinationen, hin und zurueck; ohne Richtung die gewohnte; Unbekanntes wirft', () => {
    expect(SORTIER_WAHLEN.map((w) => w.wert)).toEqual(['alpha:asc', 'alpha:desc', 'count:desc', 'count:asc'])
    expect(sortierWahlWert(undefined, undefined)).toBe('alpha:asc')
    expect(sortierWahlWert('count', undefined)).toBe('count:desc')
    expect(sortierWahlWert('alpha', 'desc')).toBe('alpha:desc')
    expect(ausSortierWahl('alpha:desc')).toEqual({ sort: 'alpha', sortDirection: 'desc' })
    expect(() => ausSortierWahl('zufall')).toThrow(/Unbekannte Sortierung/)
  })
})

describe('Server-Schema behaelt die Sortier-Angaben', () => {
  const facets = [
    { metaKey: 'year', label: 'Year', type: 'number', multi: true, visible: true, sort: 'alpha', sortDirection: 'desc', max: 5, columns: 2 },
    { metaKey: 'track', label: 'Track', type: 'string', multi: true, visible: true, sort: 'count', max: null, columns: null },
  ]

  it('parseFacetDefs liefert sort, sortDirection, max und columns (vorher: verworfen)', () => {
    const library = { id: 'lib-sort', config: { chat: { gallery: { detailViewType: 'session', facets } } } } as unknown as Library
    const defs = parseFacetDefs(library)
    expect(defs.find((d) => d.metaKey === 'year')).toMatchObject({ sort: 'alpha', sortDirection: 'desc', max: 5, columns: 2 })
    const track = defs.find((d) => d.metaKey === 'track')
    expect(track).toMatchObject({ sort: 'count', columns: 1 })
    expect(track?.sortDirection).toBeUndefined()
    expect(track?.max).toBeUndefined()
  })

  it('ungueltige Werte weist die Pruefung mit Pfad ab — kein stiller Rueckfall', () => {
    const r = validiereChatKonfiguration({ gallery: { detailViewType: 'session', facets: [{ metaKey: 'year', type: 'number', sort: 'zufall', sortDirection: 'runter', max: 0, columns: 7 }] } })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      for (const feld of ['sort', 'sortDirection', 'max', 'columns']) {
        expect(r.fehler.some((f) => f.startsWith(`gallery.facets.0.${feld}`))).toBe(true)
      }
    }
  })
})
