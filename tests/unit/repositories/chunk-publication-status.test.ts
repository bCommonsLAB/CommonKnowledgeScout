/**
 * Befund 06.11.2026: der Veroeffentlichungs-Status wird an die Chunks gespiegelt,
 * damit der Gast-Filter der Vektorsuche ein Feld prueft statt einer Id-Liste.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const col = vi.hoisted(() => ({
  updateMany: vi.fn(async () => ({ matchedCount: 3, modifiedCount: 2 })),
}))
vi.mock('@/lib/repositories/vector-repo', () => ({ getCollectionOnly: async () => col }))

import { CHUNK_KINDS, chunkPublicationUpdate, publicationStatusAus, setChunkPublicationStatus } from '@/lib/repositories/chunk-publication-status'

beforeEach(() => vi.clearAllMocks())

describe('publicationStatusAus', () => {
  it('nur status draft ist ein Entwurf; fehlend, leer oder published sind sichtbar', () => {
    expect(publicationStatusAus({ publication: { status: 'draft' } })).toBe('draft')
    expect(publicationStatusAus({ publication: { status: 'published' } })).toBe('published')
    expect(publicationStatusAus({ publication: {} })).toBe('published')
    expect(publicationStatusAus({})).toBe('published')
    expect(publicationStatusAus(undefined)).toBe('published')
    expect(publicationStatusAus({ publication: 'draft' })).toBe('published')
  })
})

describe('chunkPublicationUpdate', () => {
  it('trifft Chunks und Kapitel-Zusammenfassungen der Quelle, nie das Meta-Dokument', () => {
    const u = chunkPublicationUpdate('F1', 'draft')
    expect(u.filter).toEqual({ fileId: 'F1', kind: { $in: ['chunk', 'chapterSummary'] } })
    expect(u.update).toEqual({ $set: { publicationStatus: 'draft' } })
    expect(CHUNK_KINDS).not.toContain('meta')
  })
})

describe('setChunkPublicationStatus', () => {
  it('schreibt per updateMany und liefert die Zahl der getroffenen Dokumente', async () => {
    const n = await setChunkPublicationStatus('vectors__x', 'F1', 'published')
    expect(n).toBe(3)
    expect(col.updateMany).toHaveBeenCalledWith(
      { fileId: 'F1', kind: { $in: ['chunk', 'chapterSummary'] } },
      { $set: { publicationStatus: 'published' } },
    )
  })
})
