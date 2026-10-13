/**
 * Bindung Library → Speicher-Verbindung (A2): Zugangsdaten kommen aus der
 * Verbindung des Besitzers, fehlende Bindung wirft mit Verweis auf das
 * Migrationsskript, Typ-Abweichung wirft, local bleibt unberuehrt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Library } from '@/types/library'

const h = vi.hoisted(() => ({ getStorageConnection: vi.fn(), findOwner: vi.fn() }))
vi.mock('@/lib/repositories/storage-connections-repo', () => ({ getStorageConnection: h.getStorageConnection }))
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ findOwnerEmailForLibraryId: h.findOwner }) },
}))

import { loadLibraryConnection, toFactoryLibrary } from '@/lib/storage-connections/library-storage'

const NC_CONN = {
  id: 'c1', ownerEmail: 'anna@example.com', label: 'Verein', type: 'nextcloud',
  nextcloud: { webdavUrl: 'https://cloud/x', username: 'anna', appPassword: 'pw' },
  lastTest: null, createdAt: 'T', updatedAt: 'U1',
}
const lib = (over: Partial<Library>): Library =>
  ({ id: 'l1', label: 'Klima', path: '/Archiv', type: 'nextcloud', isEnabled: true, transcription: 'shadowTwin', config: { chat: {} }, ...over }) as Library

beforeEach(() => {
  vi.resetAllMocks()
  h.findOwner.mockResolvedValue('anna@example.com')
})

describe('toFactoryLibrary', () => {
  it('mischt die Nextcloud-Zugangsdaten der Verbindung ein und traegt Id und Stand fuer den Cache', async () => {
    h.getStorageConnection.mockResolvedValue(NC_CONN)
    const f = await toFactoryLibrary(lib({ storageConnectionId: 'c1' }), '/Archiv')
    expect(f.config).toMatchObject({ chat: {}, nextcloud: { webdavUrl: 'https://cloud/x', username: 'anna', appPassword: 'pw' } })
    expect(f.storageConnectionId).toBe('c1')
    expect(f.storageConnectionUpdatedAt).toBe('U1')
    expect(h.getStorageConnection).toHaveBeenCalledWith('anna@example.com', 'c1')
  })

  it('laesst local unberuehrt (keine Verbindung, Owner-Entscheid E1)', async () => {
    const f = await toFactoryLibrary(lib({ type: 'local', path: '/srv/a' }), '/srv/a')
    expect(f.storageConnectionId).toBeUndefined()
    expect(h.getStorageConnection).not.toHaveBeenCalled()
  })
})

describe('loadLibraryConnection', () => {
  it('wirft ohne Bindung mit Verweis auf das Migrationsskript — kein Rueckfall auf Altfelder', async () => {
    await expect(loadLibraryConnection(lib({ config: { nextcloud: NC_CONN.nextcloud } as never }))).rejects.toThrow(/migrate-storage-connections/)
  })

  it('wirft, wenn die Verbindung fehlt oder einen anderen Typ hat', async () => {
    h.getStorageConnection.mockResolvedValue(null)
    await expect(loadLibraryConnection(lib({ storageConnectionId: 'c1' }))).rejects.toThrow(/existiert nicht mehr/)
    h.getStorageConnection.mockResolvedValue({ ...NC_CONN, type: 'onedrive' })
    await expect(loadLibraryConnection(lib({ storageConnectionId: 'c1' }))).rejects.toThrow(/onedrive/)
  })

  it('nutzt den uebergebenen Besitzer ohne Suche', async () => {
    h.getStorageConnection.mockResolvedValue(NC_CONN)
    await loadLibraryConnection(lib({ storageConnectionId: 'c1' }), 'anna@example.com')
    expect(h.findOwner).not.toHaveBeenCalled()
  })
})
