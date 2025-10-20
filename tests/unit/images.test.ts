import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks MÜSSEN vor dem Import des SUT definiert werden
vi.mock('@/lib/storage/server-provider', () => ({
  getServerProvider: vi.fn().mockResolvedValue({
    listItemsById: vi.fn().mockResolvedValue([]),
  })
}))

vi.mock('@/lib/transform/image-extraction-service', () => ({
  ImageExtractionService: {
    saveZipArchive: vi.fn().mockResolvedValue({ savedItems: [{ id: 'img-1' }, { id: 'img-2' }] })
  }
}))

const setupFetchOk = () => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([1,2,3]).buffer }))

import { maybeProcessImages } from '@/lib/external-jobs/images'

describe('images', () => {
  beforeEach(() => {
    // Nicht alle Mocks zurücksetzen, um Modul-Mocks zu behalten
    setupFetchOk()
  })
  it('downloads and saves images, returns saved ids', async () => {
    const ctx = { jobId: 'j', job: { userEmail: 'u', libraryId: 'L', correlation: { source: { name: 'doc.pdf' } } }, body: {} } as any
    const res = await maybeProcessImages({ ctx, parentId: 'root', imagesZipUrl: '/api/zip', extractedText: 'X', lang: 'de' })
    expect(res && res.savedItemIds.length).toBe(2)
  })
})


