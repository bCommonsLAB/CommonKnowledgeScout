/**
 * @fileoverview Unit-Tests fuer executeAdoption:
 * - Welle 5c-Guard: Artefakte ohne ladbare Datei werden uebersprungen und
 *   geloggt — nie mit leerem Inhalt upsertet.
 * - Welle 0c: Die Dateien des Quell-Ordners werden an den Migrations-Writer
 *   durchgereicht, damit Sidecar-Artefakte (Legacy-Layout ohne `_`-Twin-Ordner)
 *   ueberhaupt geladen werden koennen.
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

const SIDECAR = {
  id: 'sc-1', type: 'file', parentId: 'top', metadata: { name: 'doc.md' },
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
      sourceId: 'src-1', sourceItem: SOURCE, shadowTwinFolderId: 'twin-1', parentItems: [],
      operation: adoptOp([
        { fileName: 'doc.md', kind: 'transcript', targetLanguage: '' },
        // Namens-Migrations-Ziel, dessen Rename nicht lief (z.B. import-Preset).
        { fileName: 'doc.template.de.md', kind: 'transformation', targetLanguage: 'de', templateName: 'template' },
      ]),
    })
    expect(writerMocks.upsertArtifactFromPrepared).toHaveBeenCalledTimes(1)
    expect(writerMocks.upsertArtifactFromPrepared).toHaveBeenCalledWith(
      expect.objectContaining({ artifactFileName: 'doc.md' }),
    )
    expect(loggerMocks.FileLogger.warn).toHaveBeenCalledWith(
      'shadow-twins/sync-engine',
      expect.stringContaining('uebersprungen'),
      expect.objectContaining({ skipped: ['doc.template.de.md'] }),
    )
  })

  it('Dateinamen-Vergleich ist case-insensitiv (OneDrive-Normalisierung)', async () => {
    await executeAdoption({
      libraryId: 'lib-1', userEmail: 'u@example.org', provider: {} as StorageProvider,
      sourceId: 'src-1', sourceItem: SOURCE, shadowTwinFolderId: 'twin-1', parentItems: [],
      operation: adoptOp([{ fileName: 'DOC.md', kind: 'transcript', targetLanguage: '' }]),
    })
    expect(writerMocks.upsertArtifactFromPrepared).toHaveBeenCalledTimes(1)
    expect(loggerMocks.FileLogger.warn).not.toHaveBeenCalled()
  })
})

describe('executeAdoption (Welle 0c: Sidecar-Layout)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    writerMocks.prepareSourceArtifacts.mockResolvedValue({
      binaryFragments: [], imageUrlMap: new Map(),
      markdownByName: new Map([['doc.md', '# Inhalt']]),
      counts: { markdownFiles: 1, imageFiles: 0, audioFiles: 0, videoFiles: 0, otherFiles: 0 },
    })
  })

  it('reicht die Dateien des Quell-Ordners als siblingItems an den Writer durch', async () => {
    await executeAdoption({
      libraryId: 'lib-1', userEmail: 'u@example.org', provider: {} as StorageProvider,
      sourceId: 'src-1', sourceItem: SOURCE,
      // Legacy-Bestand: KEIN Twin-Ordner, Artefakt liegt neben der Quelle.
      shadowTwinFolderId: null, parentItems: [SOURCE, SIDECAR],
      operation: adoptOp([{ fileName: 'doc.md', kind: 'transcript', targetLanguage: '' }]),
    })
    expect(writerMocks.prepareSourceArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({ siblingItems: [SOURCE, SIDECAR], shadowTwinFolderId: undefined }),
    )
    // Ohne die Durchreichung fand der Writer nichts -> 0 Upserts trotz "executed".
    expect(writerMocks.upsertArtifactFromPrepared).toHaveBeenCalledTimes(1)
    expect(loggerMocks.FileLogger.warn).not.toHaveBeenCalled()
  })
})
