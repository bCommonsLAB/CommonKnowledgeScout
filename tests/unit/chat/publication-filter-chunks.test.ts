/**
 * Befund 06.11.2026: der Gast-Filter der Chunks prueft EIN Feld
 * (`publicationStatus`) statt einer Liste aller Entwurfs-Ids.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const members = vi.hoisted(() => ({ isModeratorOrOwner: vi.fn(async () => false) }))
vi.mock('@/lib/repositories/library-members-repo', () => ({ isModeratorOrOwner: members.isModeratorOrOwner }))

import { applyDraftExclusionToChunkFilter, chunkPublicationVisibilityFilter } from '@/lib/chat/publication-filter'

beforeEach(() => vi.clearAllMocks())

describe('chunkPublicationVisibilityFilter', () => {
  it('ist $ne draft auf publicationStatus — Chunks ohne Feld bleiben sichtbar, keine Whitelist', () => {
    const f = chunkPublicationVisibilityFilter() as { publicationStatus: Record<string, unknown> }
    expect(f.publicationStatus).toEqual({ $ne: 'draft' })
    expect(f.publicationStatus).not.toHaveProperty('$in')
    expect(f).not.toHaveProperty('fileId')
  })
})

describe('applyDraftExclusionToChunkFilter', () => {
  it('Gast: setzt das Feld in den Filter, ohne eine Id-Liste zu laden', async () => {
    const filter: Record<string, unknown> = { libraryId: 'lib' }
    const r = await applyDraftExclusionToChunkFilter(filter, 'vectors__x', 'lib', null)
    expect(r).toBe(filter)
    expect(filter).toEqual({ libraryId: 'lib', publicationStatus: { $ne: 'draft' } })
  })

  it('Owner oder Moderation: Filter bleibt unveraendert', async () => {
    members.isModeratorOrOwner.mockResolvedValueOnce(true)
    const filter: Record<string, unknown> = { libraryId: 'lib' }
    await applyDraftExclusionToChunkFilter(filter, 'vectors__x', 'lib', 'owner@example.org')
    expect(filter).toEqual({ libraryId: 'lib' })
  })

  it('wirft, wenn der Filter publicationStatus schon traegt (kein stilles Ueberschreiben)', async () => {
    await expect(applyDraftExclusionToChunkFilter({ publicationStatus: 'draft' }, 'vectors__x', 'lib', null)).rejects.toThrow(/traegt schon publicationStatus/)
  })
})
