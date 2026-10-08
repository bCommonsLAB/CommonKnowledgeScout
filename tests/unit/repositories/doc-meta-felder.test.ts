/**
 * Welle C — Feld-Patches treffen Meta-Dokument (docMetaJson + Spiegel) UND
 * die Chunks derselben Quelle; leere Patches schreiben nichts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ updateOne: vi.fn(), updateMany: vi.fn() }))
vi.mock('@/lib/repositories/vector-repo', () => ({
  getCollectionOnly: async () => ({ updateOne: h.updateOne, updateMany: h.updateMany }),
}))

import { patchChunkFelder, patchMetaDokumentFelder } from '@/lib/repositories/doc-meta-felder'

beforeEach(() => {
  h.updateOne.mockReset().mockResolvedValue({ matchedCount: 1 })
  h.updateMany.mockReset().mockResolvedValue({ modifiedCount: 7 })
})

describe('patchMetaDokumentFelder', () => {
  it('schreibt docMetaJson und den Top-Level-Spiegel fuer Spiegel-Felder', async () => {
    await patchMetaDokumentFelder('lib_key', 'f1', { tags: ['fokus'], lv_bewertung: 'beschlossen' })
    const [filter, update] = h.updateOne.mock.calls[0]
    expect(filter).toEqual({ _id: 'f1-meta', kind: 'meta' })
    expect(update.$set).toMatchObject({ 'docMetaJson.tags': ['fokus'], tags: ['fokus'], 'docMetaJson.lv_bewertung': 'beschlossen' })
    expect(update.$set).not.toHaveProperty('lv_bewertung')
  })
})

describe('patchChunkFelder', () => {
  it('setzt die Felder an allen Chunks der Quelle und liefert die Anzahl', async () => {
    expect(await patchChunkFelder('lib_key', 'f1', { lv_bewertung: 'beschlossen' })).toBe(7)
    const [filter, update] = h.updateMany.mock.calls[0]
    expect(filter).toEqual({ kind: 'chunk', fileId: 'f1' })
    expect(update.$set).toMatchObject({ lv_bewertung: 'beschlossen' })
    expect(typeof update.$set.upsertedAt).toBe('string')
  })

  it('schreibt bei leerem Patch nichts', async () => {
    expect(await patchChunkFelder('lib_key', 'f1', {})).toBe(0)
    expect(h.updateMany).not.toHaveBeenCalled()
  })
})
