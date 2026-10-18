/**
 * Welle F1 (ADR 0012): `starred=<k>` und `sort=stars` serverseitig —
 * gueltige Werte, Rechte je Rolle und Schalter, Anhaengen an den Filter.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  parseStarred,
  sortStarsPruefen,
  sterneSichtbar,
  sternFilterAnhaengen,
  sternFilterAusQuery,
} from '@/lib/documents/stern-filter'

const url = (qs: string) => new URL(`http://x/api/chat/lib-1/docs${qs}`)

describe('parseStarred', () => {
  it('fehlend oder leer = kein Filter', () => {
    expect(parseStarred(null)).toEqual({ ok: true, k: null })
    expect(parseStarred('')).toEqual({ ok: true, k: null })
    expect(parseStarred('  ')).toEqual({ ok: true, k: null })
  })

  it('ganze Zahl >= 1 wird uebernommen', () => {
    expect(parseStarred('1')).toEqual({ ok: true, k: 1 })
    expect(parseStarred('3')).toEqual({ ok: true, k: 3 })
  })

  it('0, negativ, Kommazahl und Text: 400, kein stiller Fallback', () => {
    for (const raw of ['0', '-1', '1.5', 'ja', 'true']) {
      const r = parseStarred(raw)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.status).toBe(400)
    }
  })
})

describe('sterneSichtbar und sortStarsPruefen', () => {
  it('Mitglied immer, Gast nur mit Schalter', () => {
    expect(sterneSichtbar(true, false)).toBe(true)
    expect(sterneSichtbar(false, true)).toBe(true)
    expect(sterneSichtbar(false, false)).toBe(false)
  })

  it('sort=stars: 403 fuer Gaeste ohne Schalter, sonst ok; andere Sorts unberuehrt', () => {
    expect(sortStarsPruefen('stars', { isMember: false, starCountsPublic: false })).toMatchObject({ ok: false, status: 403 })
    expect(sortStarsPruefen('stars', { isMember: false, starCountsPublic: true })).toEqual({ ok: true })
    expect(sortStarsPruefen('stars', { isMember: true, starCountsPublic: false })).toEqual({ ok: true })
    expect(sortStarsPruefen('rating', { isMember: false, starCountsPublic: false })).toEqual({ ok: true })
    expect(sortStarsPruefen(null, { isMember: false, starCountsPublic: false })).toEqual({ ok: true })
  })
})

describe('sternFilterAusQuery', () => {
  const ctx = { libraryId: 'lib-1', isMember: false, starCountsPublic: true }

  it('ohne starred: kein Filter, kein DB-Zugriff', async () => {
    const laden = vi.fn()
    expect(await sternFilterAusQuery(url(''), ctx, laden)).toEqual({ ok: true, fileIds: null })
    expect(laden).not.toHaveBeenCalled()
  })

  it('starred=2 laedt die fileIds mit mindestens 2 Sternen', async () => {
    const laden = vi.fn(async () => ['a', 'b'])
    expect(await sternFilterAusQuery(url('?starred=2'), ctx, laden)).toEqual({ ok: true, fileIds: ['a', 'b'] })
    expect(laden).toHaveBeenCalledWith('lib-1', 2)
  })

  it('Gast ohne Schalter: 403, nichts geladen', async () => {
    const laden = vi.fn()
    const r = await sternFilterAusQuery(url('?starred=1'), { ...ctx, starCountsPublic: false }, laden)
    expect(r).toMatchObject({ ok: false, status: 403 })
    expect(laden).not.toHaveBeenCalled()
  })

  it('Mitglied ohne Schalter darf', async () => {
    const laden = vi.fn(async () => ['a'])
    const r = await sternFilterAusQuery(url('?starred=1'), { ...ctx, isMember: true, starCountsPublic: false }, laden)
    expect(r).toEqual({ ok: true, fileIds: ['a'] })
  })

  it('ungueltiges starred: 400 vor der Rechtepruefung', async () => {
    const laden = vi.fn()
    const r = await sternFilterAusQuery(url('?starred=abc'), ctx, laden)
    expect(r).toMatchObject({ ok: false, status: 400 })
    expect(laden).not.toHaveBeenCalled()
  })
})

describe('sternFilterAnhaengen', () => {
  it('null laesst den Filter unveraendert', () => {
    const filter: Record<string, unknown> = { $or: [{ title: 'x' }] }
    sternFilterAnhaengen(filter, null)
    expect(filter).toEqual({ $or: [{ title: 'x' }] })
  })

  it('haengt per $and an und behaelt bestehende $and-Glieder und $or', () => {
    const filter: Record<string, unknown> = { $or: [{ title: 'x' }], $and: [{ detailViewType: 'a' }] }
    sternFilterAnhaengen(filter, ['f1', 'f2'])
    expect(filter).toEqual({
      $or: [{ title: 'x' }],
      $and: [{ detailViewType: 'a' }, { fileId: { $in: ['f1', 'f2'] } }],
    })
  })

  it('leere Liste ergibt $in: [] (keine Treffer), nicht „kein Filter"', () => {
    const filter: Record<string, unknown> = {}
    sternFilterAnhaengen(filter, [])
    expect(filter).toEqual({ $and: [{ fileId: { $in: [] } }] })
  })
})
