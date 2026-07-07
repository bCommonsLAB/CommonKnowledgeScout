import { describe, it, expect } from 'vitest'
import {
  resolveColumnSort,
  buildColumnSortStages,
  type FacetDefLike,
} from '@/lib/gallery/column-sort'

const defs: FacetDefLike[] = [
  { metaKey: 'co2_einsparung_kt', type: 'number' },
  { metaKey: 'arbeitsgruppe', type: 'string' },
  { metaKey: 'tags', type: 'string[]' },
  { metaKey: 'massnahme_nr', type: 'integer-range' },
]

describe('resolveColumnSort', () => {
  it('liefert null, wenn keine Spalten-Sortierung angefragt ist', () => {
    expect(resolveColumnSort(null, null, defs, false)).toBeNull()
  })

  it('lehnt einzelne Params explizit ab (kein Silent Fallback)', () => {
    const res = resolveColumnSort('title', null, defs, false)
    expect(res).toEqual(expect.objectContaining({ ok: false, status: 400 }))
  })

  it('lehnt ungueltige Richtung ab', () => {
    const res = resolveColumnSort('title', 'up', defs, false)
    expect(res).toEqual(expect.objectContaining({ ok: false, status: 400 }))
  })

  it('lehnt unbekannte Felder ab (Whitelist)', () => {
    const res = resolveColumnSort('$where', 'asc', defs, false)
    expect(res).toEqual(expect.objectContaining({ ok: false, status: 400 }))
  })

  it('title/upsertedAt sind Top-Level-Felder', () => {
    expect(resolveColumnSort('title', 'asc', defs, false)).toEqual({
      ok: true,
      spec: { field: 'title', dir: 1, numeric: false, source: 'top' },
    })
    expect(resolveColumnSort('upsertedAt', 'desc', defs, false)).toEqual({
      ok: true,
      spec: { field: 'upsertedAt', dir: -1, numeric: false, source: 'top' },
    })
  })

  it('favoriteCount ist Member-only (403 fuer Gaeste)', () => {
    expect(resolveColumnSort('favoriteCount', 'desc', defs, false)).toEqual(
      expect.objectContaining({ ok: false, status: 403 }),
    )
    expect(resolveColumnSort('favoriteCount', 'desc', defs, true)).toEqual({
      ok: true,
      spec: { field: 'favoriteCount', dir: -1, numeric: true, source: 'favorites' },
    })
  })

  it('prioritaets_index ist auch ohne Facette sortierbar (persistiertes Feld)', () => {
    expect(resolveColumnSort('prioritaets_index', 'desc', [], false)).toEqual({
      ok: true,
      spec: { field: 'prioritaets_index', dir: -1, numeric: true, source: 'meta' },
    })
  })

  it('number/integer-range-Facetten sortieren numerisch, Rest als String', () => {
    expect(resolveColumnSort('co2_einsparung_kt', 'desc', defs, false)).toEqual({
      ok: true,
      spec: { field: 'co2_einsparung_kt', dir: -1, numeric: true, source: 'meta' },
    })
    expect(resolveColumnSort('massnahme_nr', 'asc', defs, false)).toEqual({
      ok: true,
      spec: { field: 'massnahme_nr', dir: 1, numeric: true, source: 'meta' },
    })
    expect(resolveColumnSort('arbeitsgruppe', 'asc', defs, false)).toEqual({
      ok: true,
      spec: { field: 'arbeitsgruppe', dir: 1, numeric: false, source: 'meta' },
    })
  })
})

describe('buildColumnSortStages', () => {
  it('numerisch: $convert nach double, Fehler/null -> leer (0 bleibt ein Wert)', () => {
    const stages = buildColumnSortStages({
      field: 'co2_einsparung_kt', dir: -1, numeric: true, source: 'meta',
    })
    expect(stages).toHaveLength(3)
    const addValue = stages[0].$addFields as Record<string, unknown>
    expect(JSON.stringify(addValue.__sortValue)).toContain('$convert')
    expect(JSON.stringify(addValue.__sortValue)).toContain('docMetaJson.co2_einsparung_kt')
    // Leer-Flag prueft NUR auf null/'' — 0 zaehlt als echter Wert.
    const emptyExpr = JSON.stringify((stages[1].$addFields as Record<string, unknown>).__sortEmpty)
    expect(emptyExpr).toContain('null')
    expect(emptyExpr).not.toContain('"0",')
  })

  it('string: $toLower nur fuer Strings, Arrays bleiben roh', () => {
    const stages = buildColumnSortStages({
      field: 'arbeitsgruppe', dir: 1, numeric: false, source: 'meta',
    })
    const valueExpr = JSON.stringify((stages[0].$addFields as Record<string, unknown>).__sortValue)
    expect(valueExpr).toContain('$toLower')
    expect(valueExpr).toContain('$type')
  })

  it('sortiert leere Werte IMMER ans Ende und paginiert stabil', () => {
    const stages = buildColumnSortStages({ field: 'title', dir: 1, numeric: false, source: 'top' })
    expect(stages[2].$sort).toEqual({
      __sortEmpty: 1,
      __sortValue: 1,
      year: -1,
      upsertedAt: -1,
      _id: 1,
    })
  })

  it('favorites-Quelle sortiert nach dem $lookup-Feld favoriteCount', () => {
    const stages = buildColumnSortStages({
      field: 'favoriteCount', dir: -1, numeric: true, source: 'favorites',
    })
    const valueExpr = JSON.stringify((stages[0].$addFields as Record<string, unknown>).__sortValue)
    expect(valueExpr).toContain('$favoriteCount')
    expect(valueExpr).not.toContain('docMetaJson')
  })
})
