/**
 * @fileoverview Unit-Tests fuer executeAdoption (Welle 5c-Guard):
 * Artefakte ohne Datei im Twin-Ordner werden uebersprungen und geloggt —
 * nie mit leerem Inhalt upsertet.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeAdoption } from '@/lib/shadow-twin/sync-engine/execute-adoption'
import type { SyncOperation } from '@/lib/shadow-twin/sync-plan/types'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

const writerMocks = vi.hoisted(() => ({
  prepareSourceArtifacts: vi.fn(),
  upsertArtifactFromPrepared: vi.fn(async () => ({ imageFiles: 0 })),
}))
vi.mock('@/lib/shadow-twin/shadow-twin-migration-writer', () => writerMocks)

const loggerMocks = vi.hoisted(() => ({
  FileLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/debug/logger', () => loggerMocks)

const SOURCE = {
  id: 'src-1', type: 'file', parentId: 'top', metadata: { name: 'doc.pdf' },
} as unknown as StorageItem

function adoptOp(artifacts: NonNullable<SyncOperation['artifacts']>): SyncOperation {
  return {
    type: 'adopt-storage-only-source', kind: 'source', targetLanguage: '',
    fileName: 'doc.pdf', count: artifacts.length, artifacts,
  }
}

describe('executeAdoption (Welle 5c-Guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    writerMocks.prepareSourceArtifacts.mockResolvedValue({
      binaryFragments: [], imageUrlMap: new Map(),
      markdownByName: new Map([['doc.md', '# Inhalt']]),
      counts: { markdownFiles: 1, imageFiles: 0, audioFiles: 0, videoFiles: 0, otherFiles: 0 },
    })
  })

  it('upsertet nur Artefakte mit vorhandener Datei; fehlende werden geloggt uebersprungen', async () => {
    await executeAdoption({
      libraryId: 'lib-1', userEmail: 'u@example.org', provider: {} as StorageProvider,
      sourceId: 'src-1', sourceItem: SOURCE, shadowTwinFolderId: 'twin-1',
      operation: adoptOp([
        { fileName: 'doc.md', kind: 'transcript', targetLanguage: '' },
        // Namens-Migrations-Ziel, dessen Rename nicht lief (z.B. import-Preset).
        { fileName: 'doc.template.de.md', kind: 'transformation', targetLanguage: 'de', templateName: 'template' },
      ]),
    })
    expect(writerMocks.upsertArtifactFromPrepared).toHaveBeenCalledTimes(1)
    expect(writerMocks.upsertArtifactFromPrepared.mock.calls[0][0]).toMatchObject({
      artifactFileName: 'doc.md',
    })
    expect(loggerMocks.FileLogger.warn).toHaveBeenCalledWith(
      'shadow-twins/sync-engine',
      expect.stringContaining('uebersprungen'),
      expect.objectContaining({ skipped: ['doc.template.de.md'] }),
    )
  })

  it('Dateinamen-Vergleich ist case-insensitiv (OneDrive-Normalisierung)', async () => {
    await executeAdoption({
      libraryId: 'lib-1', userEmail: 'u@example.org', provider: {} as StorageProvider,
      sourceId: 'src-1', sourceItem: SOURCE, shadowTwinFolderId: 'twin-1',
      operation: adoptOp([{ fileName: 'DOC.md', kind: 'transcript', targetLanguage: '' }]),
    })
    expect(writerMocks.upsertArtifactFromPrepared).toHaveBeenCalledTimes(1)
    expect(loggerMocks.FileLogger.warn).not.toHaveBeenCalled()
  })
})
