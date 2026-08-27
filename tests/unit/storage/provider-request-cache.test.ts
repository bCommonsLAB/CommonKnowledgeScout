import { describe, expect, it } from 'vitest'
import { withRequestStorageCache } from '@/lib/storage/provider-request-cache'

class ProtoProvider {
  name = 'proto'
  id = 'proto'

  calls = {
    list: 0,
    binary: 0,
    update: 0,
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

  async updateFile(itemId: string, content: Blob, options: { ifVersion: string }) {
    this.calls.update += 1
    return { id: itemId, version: `v${this.calls.update}-${options.ifVersion}-${content.size}` }
  }

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

/**
 * Welle ST1: Die Mutations-Liste im Cache ist eine POSITIVLISTE — eine
 * Schreiboperation, die nicht darin steht, invalidiert nichts, und der
 * naechste Read im selben Request liefert den Stand von VOR dem Schreiben.
 * Beim Schreiben faellt das nicht auf, sondern erst dort, wo jemand dem
 * Gelesenen vertraut. Dieser Test haelt `updateFile` in der Liste fest.
 */
describe('withRequestStorageCache: updateFile invalidiert', () => {
  it('liest nach updateFile neu, statt den gecachten Stand zu wiederholen', async () => {
    const p = new ProtoProvider()
    const cached = withRequestStorageCache(p as any)

    await cached.listItemsById('f1')
    await cached.listItemsById('f1')
    expect(p.calls.list).toBe(1) // gecacht

    await (cached as any).updateFile('f1:x', new Blob(['neu']), { ifVersion: 'etag-alt' })

    await cached.listItemsById('f1')
    expect(p.calls.list).toBe(2) // Cache war invalidiert
  })

  it('reicht Argumente und Ergebnis unveraendert durch', async () => {
    const p = new ProtoProvider()
    const cached = withRequestStorageCache(p as any)

    const ergebnis = await (cached as any).updateFile('id-1', new Blob(['abc']), { ifVersion: 'etag-alt' })

    expect(ergebnis).toEqual({ id: 'id-1', version: 'v1-etag-alt-3' })
  })
})
