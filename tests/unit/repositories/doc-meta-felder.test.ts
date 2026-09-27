/**
 * B2 — Feld-Patch am Meta-Dokument: docMetaJson UND gespiegelte Facetten.
 */
import { describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({ updateOne: vi.fn(async () => ({ matchedCount: 1 })) }))
vi.mock('@/lib/repositories/vector-repo', () => ({
  getCollectionOnly: async () => ({ updateOne: h.updateOne }),
}))

import { patchMetaDokumentFelder } from '@/lib/repositories/doc-meta-felder'

describe('patchMetaDokumentFelder', () => {
  it('schreibt docMetaJson.<feld> und den Top-Level-Spiegel fuer Facetten', async () => {
    const ok = await patchMetaDokumentFelder('col', 'f1', { tags: ['fokus'], menu_order: 2 })
    expect(ok).toBe(true)
    const [filter, update] = h.updateOne.mock.calls[0] as unknown as [Record<string, unknown>, { $set: Record<string, unknown> }]
    expect(filter).toEqual({ _id: 'f1-meta', kind: 'meta' })
    expect(update.$set['docMetaJson.tags']).toEqual(['fokus'])
    expect(update.$set['tags']).toEqual(['fokus'])
    expect(update.$set['docMetaJson.menu_order']).toBe(2)
    expect(update.$set['menu_order']).toBeUndefined()
    expect(typeof update.$set['upsertedAt']).toBe('string')
  })

  it('ohne Felder wird nichts geschrieben', async () => {
    h.updateOne.mockClear()
    expect(await patchMetaDokumentFelder('col', 'f1', {})).toBe(true)
    expect(h.updateOne).not.toHaveBeenCalled()
  })

  it('kein Meta-Dokument = false (Quelle nicht publiziert)', async () => {
    h.updateOne.mockResolvedValueOnce({ matchedCount: 0 })
    expect(await patchMetaDokumentFelder('col', 'f2', { tags: ['x'] })).toBe(false)
  })
})
