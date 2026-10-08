/**
 * Welle F — Kennungen des Sets gegen die Meta-Dokumente aufloesen: fehlende
 * und doppelte Kennungen sind Fehler, Zahlen werden in beiden Formen gesucht.
 */
import { describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({ docs: [] as Array<Record<string, unknown>>, letzterFilter: null as unknown }))
vi.mock('@/lib/repositories/vector-repo', () => ({
  getCollectionOnly: async () => ({
    find: (filter: unknown) => { h.letzterFilter = filter; return { toArray: async () => h.docs } },
  }),
}))

import { loeseKennungenAuf } from '@/lib/chat/golden-set/lauf'
import type { GoldenSet } from '@/lib/chat/golden-set/schema'

const SET: GoldenSet = {
  kennungFeld: 'massnahme_nr',
  fragen: [{ id: 'q1', frage: 'x', typ: 'direkt', erwarteteDokumente: [{ massnahme_nr: '38' }, { massnahme_nr: '12' }], pflicht: { zuschreibung: true, gruppierung: false } }],
}

describe('loeseKennungenAuf', () => {
  it('bildet Kennung → fileId und sucht Zahlen als String und Zahl', async () => {
    h.docs = [{ fileId: 'f38', docMetaJson: { massnahme_nr: 38 } }, { fileId: 'f12', docMetaJson: { massnahme_nr: '12' } }]
    const map = await loeseKennungenAuf(SET, 'lib_key', 'lib')
    expect([...map.entries()]).toEqual([['38', 'f38'], ['12', 'f12']])
    expect(JSON.stringify(h.letzterFilter)).toContain('"$in":["38",38,"12",12]')
  })

  it('wirft bei fehlender und bei doppelter Kennung', async () => {
    h.docs = [{ fileId: 'f38', docMetaJson: { massnahme_nr: 38 } }]
    await expect(loeseKennungenAuf(SET, 'lib_key', 'lib')).rejects.toThrow(/ohne Meta-Dokument \(massnahme_nr\): 12/)
    h.docs = [{ fileId: 'a', docMetaJson: { massnahme_nr: 38 } }, { fileId: 'b', docMetaJson: { massnahme_nr: '38' } }, { fileId: 'c', docMetaJson: { massnahme_nr: 12 } }]
    await expect(loeseKennungenAuf(SET, 'lib_key', 'lib')).rejects.toThrow(/mehreren Dokumenten/)
  })
})
