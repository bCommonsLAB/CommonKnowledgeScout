/**
 * Welle J Nachzug: Seitenbilder im Filesystem-Modus nach dem Mongo-Speichern
 * aus dem Twin-Ordner als Fragmente registrieren —
 * `src/lib/external-jobs/extract-page-images-register.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/debug/logger', () => ({ FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
const bufferLog = vi.fn()
vi.mock('@/lib/external-jobs-log-buffer', () => ({ bufferLog: (...a: unknown[]) => bufferLog(...a) }))
const reconstructPageImages = vi.fn()
vi.mock('@/lib/shadow-twin/reconstruct-from-storage', () => ({ reconstructPageImages: (...a: unknown[]) => reconstructPageImages(...a) }))

import { registrierePageImagesAusTwinOrdner } from '@/lib/external-jobs/extract-page-images-register'
import type { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

const sourceItem = { id: 'pdf-1', type: 'file', parentId: 'ordner', metadata: { name: 'Folien.pdf' } } as unknown as StorageItem
const twinItems = [
  { id: 'a', type: 'file', metadata: { name: 'preview_001.jpg' } },
  { id: 'b', type: 'file', metadata: { name: 'page_001.jpeg' } },
] as unknown as StorageItem[]

function mkRepo() {
  const traceAddEvent = vi.fn(async () => undefined)
  return { repo: { traceAddEvent } as unknown as ExternalJobsRepository, traceAddEvent }
}

beforeEach(() => {
  bufferLog.mockReset(); reconstructPageImages.mockReset()
})

describe('registrierePageImagesAusTwinOrdner', () => {
  it('listet den Twin-Ordner, registriert ueber reconstructPageImages und meldet Log + Trace', async () => {
    const listItemsById = vi.fn(async () => twinItems)
    const provider = { listItemsById } as unknown as StorageProvider
    reconstructPageImages.mockResolvedValue(2)
    const { repo, traceAddEvent } = mkRepo()

    const r = await registrierePageImagesAusTwinOrdner({
      provider, repo, jobId: 'job-1', libraryId: 'lib', userEmail: 'u@x', sourceItem, parentId: 'ordner', shadowTwinFolderId: 'twin',
    })

    expect(listItemsById).toHaveBeenCalledWith('twin')
    expect(reconstructPageImages).toHaveBeenCalledWith(expect.objectContaining({ libraryId: 'lib', userEmail: 'u@x', sourceItem, parentId: 'ordner', items: twinItems }))
    expect(r).toEqual({ twinItems: 2, registriert: 2 })
    expect(bufferLog).toHaveBeenCalledWith('job-1', expect.objectContaining({ phase: 'extract_only_page_images_registered', registriert: 2 }))
    expect(traceAddEvent).toHaveBeenCalledWith('job-1', expect.objectContaining({ name: 'extract_only_page_images_registered', attributes: { twinItems: 2, registriert: 2 } }))
  })

  it('ohne Twin-Ordner: nichts registrieren, aber laut im Trace', async () => {
    const provider = { listItemsById: vi.fn() } as unknown as StorageProvider
    const { repo, traceAddEvent } = mkRepo()
    const r = await registrierePageImagesAusTwinOrdner({
      provider, repo, jobId: 'job-2', libraryId: 'lib', userEmail: 'u@x', sourceItem, parentId: 'ordner', shadowTwinFolderId: undefined,
    })
    expect(r).toEqual({ twinItems: 0, registriert: 0, uebersprungen: 'kein_twin_ordner' })
    expect(reconstructPageImages).not.toHaveBeenCalled()
    expect(traceAddEvent).toHaveBeenCalledWith('job-2', expect.objectContaining({ name: 'extract_only_page_images_skipped', level: 'warn' }))
  })

  it('reicht Fehler der Registrierung nach oben (extract-only meldet sie)', async () => {
    const provider = { listItemsById: vi.fn(async () => twinItems) } as unknown as StorageProvider
    reconstructPageImages.mockRejectedValue(new Error('Azure Storage nicht konfiguriert'))
    const { repo } = mkRepo()
    await expect(registrierePageImagesAusTwinOrdner({
      provider, repo, jobId: 'job-3', libraryId: 'lib', userEmail: 'u@x', sourceItem, parentId: 'ordner', shadowTwinFolderId: 'twin',
    })).rejects.toThrow('Azure Storage nicht konfiguriert')
  })
})
