/**
 * @fileoverview Schaufenster-Eintrag auf neue fileId umschreiben (Befund 23.09.2026).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const col = vi.hoisted(() => ({
  docs: [] as Array<Record<string, unknown>>,
  find: vi.fn((q: { fileId: string }) => ({ toArray: async () => col.docs.filter((d) => d.fileId === q.fileId) })),
  countDocuments: vi.fn(async (q: { fileId: string }) => col.docs.filter((d) => d.fileId === q.fileId).length),
  insertMany: vi.fn(async (neu: Array<Record<string, unknown>>) => { col.docs.push(...neu) }),
  deleteMany: vi.fn(async (q: { fileId: string }) => { col.docs = col.docs.filter((d) => d.fileId !== q.fileId) }),
}))

vi.mock('@/lib/repositories/vector-repo', () => ({ getCollectionOnly: async () => col }))
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { rekeyVectorsFileId } from '@/lib/repositories/vector-rekey'

beforeEach(() => {
  vi.clearAllMocks()
  col.docs = [
    { _id: 'ALT-meta', kind: 'meta', fileId: 'ALT', title: 'Kompass' },
    { _id: 'ALT-0', kind: 'chunk', fileId: 'ALT', chunkIndex: 0 },
    { _id: 'fremd-0', kind: 'chunk', fileId: 'ALT', chunkIndex: 1 },
    { _id: 'X-meta', kind: 'meta', fileId: 'X' },
  ]
})

describe('rekeyVectorsFileId', () => {
  it('kopiert Meta + Chunks unter neuer _id/fileId und loescht die alten; Fremde bleiben', async () => {
    const r = await rekeyVectorsFileId('vectors__x', 'ALT', 'NEU')
    expect(r.umgeschrieben).toBe(3)
    const ids = col.docs.map((d) => d._id).sort()
    expect(ids).toEqual(['NEU-0', 'NEU-meta', 'X-meta', 'fremd-0'])
    expect(col.docs.filter((d) => d.fileId === 'ALT')).toHaveLength(0)
    expect(col.docs.find((d) => d._id === 'NEU-meta')).toMatchObject({ fileId: 'NEU', title: 'Kompass' })
  })

  it('ohne alten Eintrag: nichts zu tun, 0', async () => {
    expect(await rekeyVectorsFileId('vectors__x', 'GIBTSNICHT', 'NEU')).toEqual({ umgeschrieben: 0 })
    expect(col.insertMany).not.toHaveBeenCalled()
  })

  it('neue fileId schon belegt: Fehler, nichts gemischt', async () => {
    await expect(rekeyVectorsFileId('vectors__x', 'ALT', 'X')).rejects.toThrow(/schon ein Eintrag/)
    expect(col.insertMany).not.toHaveBeenCalled()
    expect(col.deleteMany).not.toHaveBeenCalled()
  })

  it('gleiche Id: kein Zugriff', async () => {
    expect(await rekeyVectorsFileId('vectors__x', 'ALT', 'ALT')).toEqual({ umgeschrieben: 0 })
    expect(col.find).not.toHaveBeenCalled()
  })
})
