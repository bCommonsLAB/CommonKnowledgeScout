/**
 * Erzeugte Webseiten (`detailViewType: website`) sind keine Quelle einer
 * Antwort — sie fallen schon bei der Suche heraus.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const repo = vi.hoisted(() => ({ findWebsiteFileIds: vi.fn(async (): Promise<string[]> => []) }))
vi.mock('@/lib/repositories/website-file-ids', () => ({ findWebsiteFileIds: repo.findWebsiteFileIds }))

import { applyWebsiteExclusionToChunkFilter, fileIdFilterOhneWebseiten } from '@/lib/chat/website-ausschluss'

beforeEach(() => vi.clearAllMocks())

describe('fileIdFilterOhneWebseiten', () => {
  it('ohne Webseiten bleibt der Filter, wie er ist', () => {
    expect(fileIdFilterOhneWebseiten(undefined, [])).toBeUndefined()
    expect(fileIdFilterOhneWebseiten({ $in: ['a'] }, [])).toEqual({ $in: ['a'] })
  })

  it('ohne fileId-Filter: Ausschluss der Webseiten', () => {
    expect(fileIdFilterOhneWebseiten(undefined, ['w1', 'w2'])).toEqual({ $nin: ['w1', 'w2'] })
  })

  it('Einschluss wird um die Webseiten gekuerzt', () => {
    expect(fileIdFilterOhneWebseiten({ $in: ['a', 'w1', 'b'] }, ['w1'])).toEqual({ $in: ['a', 'b'] })
    expect(fileIdFilterOhneWebseiten(['a', 'w1'], ['w1'])).toEqual({ $in: ['a'] })
    expect(fileIdFilterOhneWebseiten('a', ['w1'])).toBe('a')
    expect(fileIdFilterOhneWebseiten('w1', ['w1'])).toEqual({ $in: [] })
  })

  it('Ausschluss wird erweitert, ohne Doppelte', () => {
    expect(fileIdFilterOhneWebseiten({ $nin: ['x', 'w1'] }, ['w1', 'w2'])).toEqual({ $nin: ['x', 'w1', 'w2'] })
  })

  it('unbekannte Form wirft (kein stilles Ueberschreiben)', () => {
    expect(() => fileIdFilterOhneWebseiten({ $ne: 'a' }, ['w1'])).toThrow(/unbekannte Form/)
    expect(() => fileIdFilterOhneWebseiten({ $in: [1] }, ['w1'])).toThrow(/keine Liste von Texten/)
  })
})

describe('applyWebsiteExclusionToChunkFilter', () => {
  it('schliesst die Webseiten der Library aus, in-place', async () => {
    repo.findWebsiteFileIds.mockResolvedValueOnce(['w1'])
    const filter: Record<string, unknown> = { libraryId: 'lib', publicationStatus: { $ne: 'draft' } }
    const r = await applyWebsiteExclusionToChunkFilter(filter, 'vectors__x', 'lib')
    expect(r).toBe(filter)
    expect(filter).toEqual({ libraryId: 'lib', publicationStatus: { $ne: 'draft' }, fileId: { $nin: ['w1'] } })
    expect(repo.findWebsiteFileIds).toHaveBeenCalledWith('vectors__x', 'lib')
  })

  it('Library ohne Webseiten: kein fileId-Feld im Filter', async () => {
    const filter: Record<string, unknown> = { libraryId: 'lib' }
    await applyWebsiteExclusionToChunkFilter(filter, 'vectors__x', 'lib')
    expect(filter).toEqual({ libraryId: 'lib' })
  })
})
