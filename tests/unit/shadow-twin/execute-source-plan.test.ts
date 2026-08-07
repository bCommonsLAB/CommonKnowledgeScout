/**
 * @fileoverview Unit-Tests fuer executeSourcePlan: welche Operation ruft welche
 * Schreib-Primitive, und greift die Sicherheitsregel (kein Loeschen nach
 * fehlgeschlagenem Gewinner-Write)?
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateShadowTwinArtifactMarkdown: vi.fn(async () => {}),
  upsertMarkdown: vi.fn(async () => ({})),
  reconstructPageImages: vi.fn(async () => 3),
  findShadowTwinFolder: vi.fn(async () => ({ id: 'twin-folder' })),
  generateShadowTwinFolderName: vi.fn((name: string) => `_${name}`),
}))

vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  updateShadowTwinArtifactMarkdown: mocks.updateShadowTwinArtifactMarkdown,
}))
vi.mock('@/lib/shadow-twin/store/shadow-twin-service', () => ({
  ShadowTwinService: class {
    upsertMarkdown = mocks.upsertMarkdown
  },
}))
vi.mock('@/lib/shadow-twin/reconstruct-from-storage', () => ({
  reconstructPageImages: mocks.reconstructPageImages,
}))
vi.mock('@/lib/storage/shadow-twin', () => ({
  findShadowTwinFolder: mocks.findShadowTwinFolder,
  generateShadowTwinFolderName: mocks.generateShadowTwinFolderName,
}))

import { executeSourcePlan, type ExecuteSourceContext } from '@/lib/shadow-twin/sync-engine/execute-source-plan'
import { FolderCache } from '@/lib/shadow-twin/sync-engine/folder-cache'
import type { SyncOperation } from '@/lib/shadow-twin/sync-plan/types'
import type { Library } from '@/types/library'
import type { StorageProvider } from '@/lib/storage/types'

function makeProvider() {
  return {
    listItemsById: vi.fn(async () => []),
    deleteItem: vi.fn(async () => {}),
    uploadFile: vi.fn(async () => ({ id: 'new-file' })),
    createFolder: vi.fn(async () => ({ id: 'created-folder' })),
    getItemById: vi.fn(async () => null),
    getBinary: vi.fn(async () => ({ blob: new Blob(['']) })),
  } as unknown as StorageProvider & {
    deleteItem: ReturnType<typeof vi.fn>
    uploadFile: ReturnType<typeof vi.fn>
  }
}

function makeCtx(provider = makeProvider()): ExecuteSourceContext & { provider: ReturnType<typeof makeProvider> } {
  return {
    library: {} as unknown as Library,
    libraryId: 'lib-1',
    userEmail: 'user@example.com',
    provider,
    folderCache: new FolderCache(provider),
    sourceId: 'src-1',
    sourceName: 'doc.pdf',
    parentId: 'parent-1',
    shadowTwinFolderId: 'twin-folder',
    twinFolderItems: [],
    sourceItem: null,
  }
}

function op(type: SyncOperation['type'], overrides: Partial<SyncOperation> = {}): SyncOperation {
  return { type, kind: 'transcript', targetLanguage: '', fileName: 'doc.md', ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('executeSourcePlan', () => {
  it('Transkript-Paar (Mongo + kanonisch) laeuft EINMAL ueber den Service-Writer', async () => {
    const ctx = makeCtx()
    const outcomes = await executeSourcePlan(
      [op('write-canonical-transcript', { markdown: 'W' }), op('update-mongo-transcript', { markdown: 'W' })],
      ctx,
    )
    expect(mocks.upsertMarkdown).toHaveBeenCalledTimes(1)
    expect(mocks.updateShadowTwinArtifactMarkdown).not.toHaveBeenCalled()
    expect(ctx.provider.uploadFile).not.toHaveBeenCalled()
    expect(outcomes.map((o) => o.executed)).toEqual([true, true])
  })

  it('nur update-mongo-transcript → reiner Repo-Write, kein Service, kein Storage-Write', async () => {
    const ctx = makeCtx()
    await executeSourcePlan([op('update-mongo-transcript', { markdown: 'W' })], ctx)
    expect(mocks.updateShadowTwinArtifactMarkdown).toHaveBeenCalledTimes(1)
    expect(mocks.upsertMarkdown).not.toHaveBeenCalled()
    expect(ctx.provider.uploadFile).not.toHaveBeenCalled()
  })

  it('nur write-canonical-transcript (Export) → Provider-Upload, KEIN Mongo-Write', async () => {
    const ctx = makeCtx()
    await executeSourcePlan([op('write-canonical-transcript', { markdown: 'W' })], ctx)
    expect(ctx.provider.uploadFile).toHaveBeenCalledTimes(1)
    expect(mocks.upsertMarkdown).not.toHaveBeenCalled()
    expect(mocks.updateShadowTwinArtifactMarkdown).not.toHaveBeenCalled()
  })

  it('Sicherheitsregel: schlaegt der Gewinner-Write fehl, wird delete-inferior-variant uebersprungen — dead-page-md aber nicht', async () => {
    mocks.upsertMarkdown.mockRejectedValueOnce(new Error('Mongo down'))
    const ctx = makeCtx()
    const outcomes = await executeSourcePlan(
      [
        op('write-canonical-transcript', { markdown: 'W' }),
        op('update-mongo-transcript', { markdown: 'W' }),
        op('delete-inferior-variant', { fileId: 'f-en', fileName: 'doc.en.md' }),
        op('delete-dead-page-md', { fileId: 'p1', fileName: 'page_001.md' }),
      ],
      ctx,
    )
    const byType = new Map(outcomes.map((o) => [o.operation.type, o]))
    expect(byType.get('delete-inferior-variant')?.executed).toBe(false)
    expect(byType.get('delete-inferior-variant')?.error).toContain('Uebersprungen')
    expect(byType.get('delete-dead-page-md')?.executed).toBe(true)
    expect(ctx.provider.deleteItem).toHaveBeenCalledTimes(1) // nur page_001.md
  })

  it('mirror-artifact-to-storage mit Overwrite: erst delete, dann upload', async () => {
    const ctx = makeCtx()
    await executeSourcePlan(
      [op('mirror-artifact-to-storage', { kind: 'transformation', templateName: 't', targetLanguage: 'de', markdown: 'M', overwrite: true, fileId: 'old-file' })],
      ctx,
    )
    expect(ctx.provider.deleteItem).toHaveBeenCalledWith('old-file')
    expect(ctx.provider.uploadFile).toHaveBeenCalledTimes(1)
  })

  it('Loeschung mit 404 gilt als erledigt (Datei war schon weg)', async () => {
    const ctx = makeCtx()
    ctx.provider.deleteItem.mockRejectedValueOnce(new Error('404 Not Found'))
    const outcomes = await executeSourcePlan([op('delete-dead-page-md', { fileId: 'p1', fileName: 'page_001.md' })], ctx)
    expect(outcomes[0].executed).toBe(true)
  })

  it('update-mongo-transformation ohne templateName → Fehler-Outcome (Contract)', async () => {
    const ctx = makeCtx()
    const outcomes = await executeSourcePlan(
      [op('update-mongo-transformation', { kind: 'transformation', targetLanguage: 'de', markdown: 'M' })],
      ctx,
    )
    expect(outcomes[0].executed).toBe(false)
    expect(outcomes[0].error).toContain('templateName')
  })

  it('Report-only-Operationen werden nie ausgefuehrt, sondern als Fehler gemeldet', async () => {
    const ctx = makeCtx()
    const outcomes = await executeSourcePlan([op('conflict')], ctx)
    expect(outcomes[0].executed).toBe(false)
    expect(outcomes[0].error).toContain('Report-only')
  })

  it('register-image-fragments ohne Quell-Item → Fehler-Outcome (Scan-Kontext fehlt)', async () => {
    const ctx = makeCtx()
    const outcomes = await executeSourcePlan([op('register-image-fragments', { kind: 'image', fileName: '', count: 3 })], ctx)
    expect(outcomes[0].executed).toBe(false)
    expect(mocks.reconstructPageImages).not.toHaveBeenCalled()
  })
})
