/**
 * Repository der Speicher-Verbindungen: Geheimnisse liegen verschluesselt in
 * der Datenbank, Aufrufer sehen Klartext; `getCollection` ist gemockt.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import type { StorageConnection } from '@/types/storage-connection'

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64')
})

function buildMockCollection() {
  return {
    createIndex: vi.fn().mockResolvedValue(undefined),
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  }
}

const NEXTCLOUD: StorageConnection = {
  id: 'c1', ownerEmail: 'anna@example.com', label: 'Verein', type: 'nextcloud',
  nextcloud: { webdavUrl: 'https://cloud.example.com/remote.php/dav/files/anna', username: 'anna', appPassword: 'geheim-123' },
  lastTest: null, createdAt: 'T0', updatedAt: 'T0',
}
const ONEDRIVE: StorageConnection = {
  id: 'c2', ownerEmail: 'anna@example.com', label: 'Firma', type: 'onedrive',
  onedrive: { tenantId: 'common', clientId: 'app-1', clientSecret: 'secret-xyz', accessToken: 'acc', refreshToken: 'ref', tokenExpiry: 123 },
  lastTest: null, createdAt: 'T0', updatedAt: 'T0',
}

describe('storage-connections-repo', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('insert verschluesselt Geheimnisse, laesst Kennungen im Klartext', async () => {
    const col = buildMockCollection()
    vi.doMock('@/lib/mongodb-service', () => ({ getCollection: vi.fn().mockResolvedValue(col) }))
    const repo = await import('@/lib/repositories/storage-connections-repo')
    await repo.insertStorageConnection(NEXTCLOUD)
    await repo.insertStorageConnection(ONEDRIVE)

    const nc = col.insertOne.mock.calls[0][0] as StorageConnection
    expect(nc.nextcloud?.appPassword.startsWith('enc:v1:')).toBe(true)
    expect(nc.nextcloud?.webdavUrl).toBe(NEXTCLOUD.nextcloud?.webdavUrl)
    expect(nc.nextcloud?.username).toBe('anna')
    const od = col.insertOne.mock.calls[1][0] as StorageConnection
    expect(od.onedrive?.clientSecret.startsWith('enc:v1:')).toBe(true)
    expect(od.onedrive?.accessToken?.startsWith('enc:v1:')).toBe(true)
    expect(od.onedrive?.refreshToken?.startsWith('enc:v1:')).toBe(true)
    expect(od.onedrive?.clientId).toBe('app-1')
    expect(od.onedrive?.tokenExpiry).toBe(123)
    expect(col.createIndex).toHaveBeenCalledWith({ ownerEmail: 1, id: 1 }, { unique: true })
  })

  it('get entschluesselt wieder zum Klartext und nimmt _id heraus', async () => {
    const col = buildMockCollection()
    vi.doMock('@/lib/mongodb-service', () => ({ getCollection: vi.fn().mockResolvedValue(col) }))
    const repo = await import('@/lib/repositories/storage-connections-repo')
    await repo.insertStorageConnection(ONEDRIVE)
    const gespeichert = col.insertOne.mock.calls[0][0]
    col.findOne.mockResolvedValue({ _id: 'mongo-id', ...gespeichert })

    const gelesen = await repo.getStorageConnection('anna@example.com', 'c2')
    expect(gelesen).toEqual(ONEDRIVE)
    expect(col.findOne).toHaveBeenCalledWith({ ownerEmail: 'anna@example.com', id: 'c2' })
  })

  it('save wirft, wenn die Verbindung fehlt; delete meldet false ohne Treffer', async () => {
    const col = buildMockCollection()
    col.updateOne.mockResolvedValue({ matchedCount: 0 })
    col.deleteOne.mockResolvedValue({ deletedCount: 0 })
    vi.doMock('@/lib/mongodb-service', () => ({ getCollection: vi.fn().mockResolvedValue(col) }))
    const repo = await import('@/lib/repositories/storage-connections-repo')
    await expect(repo.saveStorageConnection(NEXTCLOUD)).rejects.toThrow(/nicht gefunden/)
    expect(await repo.deleteStorageConnection('anna@example.com', 'c1')).toBe(false)
  })

  it('weist leere ownerEmail laut ab', async () => {
    vi.doMock('@/lib/mongodb-service', () => ({ getCollection: vi.fn().mockResolvedValue(buildMockCollection()) }))
    const repo = await import('@/lib/repositories/storage-connections-repo')
    await expect(repo.listStorageConnections('  ')).rejects.toThrow(/ownerEmail/)
  })
})
