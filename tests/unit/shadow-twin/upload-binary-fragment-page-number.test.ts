/**
 * Welle J Nachzug 3: `uploadBinaryFragment` speichert `pageNumber` mit —
 * vorher stand das Feld nur im Typ, die nachregistrierten Seitenbilder hatten
 * keine Seitennummer (Befund 11.10.2026, Cover „keine PDF-Quelle mit Seitenbildern").
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/debug/logger', () => ({ FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/shadow-twin/shadow-twin-config', () => ({
  getShadowTwinConfig: () => ({ primaryStore: 'mongo', persistToFilesystem: false }),
}))
vi.mock('@/lib/config/azure-storage', () => ({ resolveAzureStorageConfig: () => ({ containerName: 'c' }) }))
vi.mock('@/lib/services/azure-storage-service', () => ({
  AzureStorageService: vi.fn().mockImplementation(() => ({
    isConfigured: () => true,
    containerExists: vi.fn(async () => true),
    getImageUrlByHashWithScope: vi.fn(async () => null),
    uploadImageToScope: vi.fn(async () => 'https://blob/x/page_002.jpeg'),
  })),
  calculateImageHash: () => 'hash123',
}))
const upsert = vi.fn(async () => undefined)
vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  upsertShadowTwinBinaryFragment: (...a: unknown[]) => upsert(...a),
}))

import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import type { Library } from '@/types/library'

beforeEach(() => upsert.mockReset())

describe('uploadBinaryFragment (Mongo-Modus)', () => {
  it('reicht pageNumber und variant in das gespeicherte Fragment durch', async () => {
    const service = new ShadowTwinService({
      library: { id: 'lib-1', config: {} } as unknown as Library,
      userEmail: 'u@x', sourceId: 'pdf-1', sourceName: 'Folien.pdf', parentId: 'ordner',
    })
    const r = await service.uploadBinaryFragment({
      buffer: Buffer.from('x'), fileName: 'page_002.jpeg', mimeType: 'image/jpeg', kind: 'image',
      variant: 'page-render', pageNumber: 2,
    })
    expect(r).toMatchObject({ name: 'page_002.jpeg', variant: 'page-render', pageNumber: 2, url: 'https://blob/x/page_002.jpeg' })
    expect(upsert).toHaveBeenCalledWith('lib-1', 'pdf-1', expect.objectContaining({ name: 'page_002.jpeg', variant: 'page-render', pageNumber: 2 }))
  })

  it('laesst pageNumber weg, wenn keine uebergeben wird', async () => {
    const service = new ShadowTwinService({
      library: { id: 'lib-1', config: {} } as unknown as Library,
      userEmail: 'u@x', sourceId: 'pdf-1', sourceName: 'Folien.pdf', parentId: 'ordner',
    })
    await service.uploadBinaryFragment({ buffer: Buffer.from('x'), fileName: 'img-0.jpeg', mimeType: 'image/jpeg', kind: 'image' })
    const gespeichert = upsert.mock.calls[0][2] as Record<string, unknown>
    expect('pageNumber' in gespeichert).toBe(false)
  })
})
