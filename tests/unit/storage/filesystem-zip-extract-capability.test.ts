import { describe, expect, it, vi } from 'vitest'
import { ImageExtractionService } from '@/lib/transform/image-extraction-service'

describe('filesystem zip extract capability', () => {
  it('uses saveAndExtractZipInFolder when provider supports it', async () => {
    const saveAndExtractZipInFolder = vi.fn(async () => {
      return [
        {
          id: 'img-1',
          parentId: 'folder-1',
          type: 'file' as const,
          metadata: { name: 'img-0.jpeg', size: 10, modifiedAt: new Date(), mimeType: 'image/jpeg' },
        },
      ]
    })

    const provider = {
      name: 'Local Filesystem',
      id: 'any',
      isAuthenticated: () => true,
      validateConfiguration: async () => ({ isValid: true as const }),
      listItemsById: async () => [],
      getItemById: async () => ({ id: 'folder-1', parentId: 'root', type: 'folder' as const, metadata: { name: '.x', size: 0, modifiedAt: new Date(), mimeType: 'application/folder' } }),
      createFolder: async () => { throw new Error('not used') },
      deleteItem: async () => { throw new Error('not used') },
      moveItem: async () => { throw new Error('not used') },
      renameItem: async () => { throw new Error('not used') },
      uploadFile: async () => { throw new Error('not used') },
      getBinary: async () => ({ blob: new Blob(['x']), mimeType: 'application/octet-stream' }),
      getPathById: async () => '/x',
      getDownloadUrl: async () => '/download',
      getStreamingUrl: async () => '/stream',
      getPathItemsById: async () => [],
      saveAndExtractZipInFolder,
    } as any

    const res = await ImageExtractionService.saveZipArchive(
      Buffer.from('not-a-real-zip').toString('base64'),
      'images.zip',
      { id: 'pdf-1', parentId: 'root', type: 'file' as const, metadata: { name: 'x.pdf', size: 1, modifiedAt: new Date(), mimeType: 'application/pdf' } } as any,
      provider,
      async () => [],
      undefined,
      'de',
      undefined,
      'folder-1'
    )

    expect(saveAndExtractZipInFolder).toHaveBeenCalledTimes(1)
    expect(res.savedItems).toHaveLength(1)
    expect(res.savedItems[0].metadata.name).toBe('img-0.jpeg')
  })
})


