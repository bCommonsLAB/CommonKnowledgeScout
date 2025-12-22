import { describe, expect, it } from 'vitest'
import { withRequestStorageCache } from '@/lib/storage/provider-request-cache'

class ProtoProvider {
  name = 'proto'
  id = 'proto'

  calls = {
    list: 0,
    binary: 0,
  }

  isAuthenticated() { return true }
  async validateConfiguration() { return { isValid: true as const } }

  async listItemsById(folderId: string) {
    this.calls.list += 1
    return [{ id: `x:${folderId}`, parentId: folderId, type: 'file' as const, metadata: { name: 'x', size: 1, modifiedAt: new Date(), mimeType: 'text/plain' } }]
  }

  async getItemById(itemId: string) { throw new Error(`not needed: ${itemId}`) }
  async createFolder(parentId: string, name: string) { throw new Error(`not needed: ${parentId}/${name}`) }
  async deleteItem(itemId: string) { throw new Error(`not needed: ${itemId}`) }
  async moveItem(itemId: string, newParentId: string) { throw new Error(`not needed: ${itemId} -> ${newParentId}`) }
  async renameItem(itemId: string, newName: string) { throw new Error(`not needed: ${itemId} -> ${newName}`) }
  async uploadFile(parentId: string, file: File) { throw new Error(`not needed: ${parentId}/${file.name}`) }

  async getBinary(fileId: string) {
    this.calls.binary += 1
    return { blob: new Blob(['x']), mimeType: 'text/plain' }
  }

  async getPathById(itemId: string) { return `/${itemId}` }
  async getDownloadUrl(itemId: string) { return `download:${itemId}` }
  async getStreamingUrl(itemId: string) { return `stream:${itemId}` }
  async getPathItemsById(itemId: string) { return [{ id: 'root', parentId: '', type: 'folder' as const, metadata: { name: 'root', size: 0, modifiedAt: new Date(), mimeType: 'application/folder' } }] }
}

describe('withRequestStorageCache', () => {
  it('preserves prototype methods (e.g. getBinary)', async () => {
    const p = new ProtoProvider()
    const cached = withRequestStorageCache(p as any)

    // Wichtig: darf nicht "undefined" werden (Regression wie im Log)
    expect(typeof (cached as any).getBinary).toBe('function')

    await (cached as any).getBinary('a')
    await (cached as any).getBinary('b')
    expect(p.calls.binary).toBe(2)
  })

  it('memoizes listItemsById within a request', async () => {
    const p = new ProtoProvider()
    const cached = withRequestStorageCache(p as any)

    const a1 = await (cached as any).listItemsById('folder-1')
    const a2 = await (cached as any).listItemsById('folder-1')
    expect(a1).toEqual(a2)
    expect(p.calls.list).toBe(1)
  })
})


