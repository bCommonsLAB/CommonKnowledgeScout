/**
 * @fileoverview Unit-Test fuer den Kaputt-Dokument-Guard in collectSourceInput:
 * Eintraege ohne Dateinamen/Ordner werden NICHT geplant (kein Muell-Spiegel).
 */

import { describe, it, expect, vi } from 'vitest'
import { collectSourceInput } from '@/lib/shadow-twin/sync-engine/collect-source-input'
import { FolderCache } from '@/lib/shadow-twin/sync-engine/folder-cache'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import type { StorageProvider } from '@/lib/storage/types'

function makeProvider() {
  return {
    listItemsById: vi.fn(async () => []),
    getBinary: vi.fn(async () => ({ blob: new Blob(['']) })),
  } as unknown as StorageProvider & { listItemsById: ReturnType<typeof vi.fn> }
}

describe('collectSourceInput — Guard fuer kaputte Dokumente', () => {
  it('ohne sourceName: keine Kandidaten, keine Transformationen, Klartext-Notiz, kein I/O', async () => {
    const provider = makeProvider()
    const doc = {
      libraryId: 'lib-1', sourceId: 'src-broken', sourceName: '', parentId: 'parent',
      artifacts: { transformation: { unknown: { de: { markdown: 'X', updatedAt: '2026-08-01T12:00:00Z' } } } },
      createdAt: '', updatedAt: '',
    } as unknown as ShadowTwinDocument

    const collected = await collectSourceInput({ doc, provider, folderCache: new FolderCache(provider) })

    expect(collected.input.transcriptCandidates).toEqual([])
    expect(collected.input.transformations).toEqual([])
    expect(collected.collectNotes[0]).toContain('ohne Dateinamen')
    expect(provider.listItemsById).not.toHaveBeenCalled()
  })

  it('ohne parentId: ebenfalls nichts geplant', async () => {
    const provider = makeProvider()
    const doc = {
      libraryId: 'lib-1', sourceId: 'src-broken', sourceName: 'doc.pdf', parentId: '',
      artifacts: {}, createdAt: '', updatedAt: '',
    } as unknown as ShadowTwinDocument

    const collected = await collectSourceInput({ doc, provider, folderCache: new FolderCache(provider) })
    expect(collected.input.transcriptCandidates).toEqual([])
    expect(collected.collectNotes).toHaveLength(1)
  })
})
