/**
 * Service der Speicher-Verbindungen: Zusammenfassung ohne Geheimnisse,
 * Pflichtfelder je Typ, „leeres Geheimnis = beibehalten", Loeschen nur ohne
 * abhaengige Library, Test speichert Ergebnis und Tokens. Repo, LibraryService
 * und Probe sind gemockt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StorageConnection } from '@/types/storage-connection'

const h = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), insert: vi.fn(), save: vi.fn(), del: vi.fn(),
  getUserLibraries: vi.fn(), probe: vi.fn(),
}))
vi.mock('@/lib/repositories/storage-connections-repo', () => ({
  listStorageConnections: h.list, getStorageConnection: h.get, insertStorageConnection: h.insert,
  saveStorageConnection: h.save, deleteStorageConnection: h.del,
}))
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getUserLibraries: h.getUserLibraries }) },
}))
vi.mock('@/lib/storage-connections/connection-probe', () => ({ probeStorageConnection: h.probe }))

import {
  createStorageConnection, deleteStorageConnection, testStorageConnection,
  toStorageConnectionSummary, updateStorageConnection, setOneDriveTokens,
} from '@/lib/storage-connections/connection-service'
import { StorageConnectionInUseError, StorageConnectionInputError } from '@/lib/storage-connections/errors'

const ONEDRIVE: StorageConnection = {
  id: 'c2', ownerEmail: 'anna@example.com', label: 'Firma', type: 'onedrive',
  onedrive: { tenantId: 'common', clientId: 'app-1', clientSecret: 'secret-xyz', accessToken: 'acc', refreshToken: 'ref', tokenExpiry: 99 },
  lastTest: null, createdAt: 'T0', updatedAt: 'T0',
}

beforeEach(() => {
  vi.resetAllMocks()
  h.getUserLibraries.mockResolvedValue([])
})

describe('toStorageConnectionSummary', () => {
  it('traegt nie Geheimnisse, nur „gesetzt" und Anmeldestatus', () => {
    const s = toStorageConnectionSummary(ONEDRIVE)
    expect(JSON.stringify(s)).not.toContain('secret-xyz')
    expect(JSON.stringify(s)).not.toContain('ref')
    expect(s.onedrive).toEqual({ tenantId: 'common', clientId: 'app-1', clientSecretSet: true, loggedIn: true, tokenExpiry: 99 })
  })
})

describe('createStorageConnection', () => {
  it('verlangt die Pflichtfelder des Typs, inklusive Geheimnis', async () => {
    await expect(createStorageConnection('anna@example.com', { label: 'X', type: 'nextcloud', nextcloud: { webdavUrl: 'https://x', username: 'u' } }))
      .rejects.toBeInstanceOf(StorageConnectionInputError)
    await expect(createStorageConnection('anna@example.com', { label: '', type: 'nextcloud' })).rejects.toThrow(/Bezeichnung/)
    await expect(createStorageConnection('anna@example.com', { label: 'X', type: 'ftp' as 'nextcloud' })).rejects.toThrow(/Verbindungstyp/)
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('legt eine Nextcloud-Verbindung an und gibt die Zusammenfassung zurueck', async () => {
    const s = await createStorageConnection('anna@example.com', {
      label: ' Verein ', type: 'nextcloud', nextcloud: { webdavUrl: 'https://cloud/x', username: 'anna', appPassword: 'pw' },
    })
    expect(h.insert).toHaveBeenCalledTimes(1)
    const gespeichert = h.insert.mock.calls[0][0] as StorageConnection
    expect(gespeichert.nextcloud?.appPassword).toBe('pw')
    expect(s.label).toBe('Verein')
    expect(s.nextcloud).toEqual({ webdavUrl: 'https://cloud/x', username: 'anna', appPasswordSet: true })
  })
})

describe('updateStorageConnection', () => {
  it('leeres Geheimnis behaelt das gespeicherte; gleiche App behaelt die Tokens', async () => {
    h.get.mockResolvedValue(ONEDRIVE)
    await updateStorageConnection('anna@example.com', 'c2', { label: 'Firma neu', type: 'onedrive', onedrive: { tenantId: 'common', clientId: 'app-1', clientSecret: '' } })
    const gespeichert = h.save.mock.calls[0][0] as StorageConnection
    expect(gespeichert.onedrive?.clientSecret).toBe('secret-xyz')
    expect(gespeichert.onedrive?.refreshToken).toBe('ref')
    expect(gespeichert.label).toBe('Firma neu')
  })

  it('andere Client-ID verwirft die Tokens; Typwechsel ist verboten', async () => {
    h.get.mockResolvedValue(ONEDRIVE)
    await updateStorageConnection('anna@example.com', 'c2', { label: 'Firma', type: 'onedrive', onedrive: { tenantId: 'common', clientId: 'app-2' } })
    const gespeichert = h.save.mock.calls[0][0] as StorageConnection
    expect(gespeichert.onedrive?.refreshToken).toBeUndefined()
    expect(gespeichert.onedrive?.clientId).toBe('app-2')
    await expect(updateStorageConnection('anna@example.com', 'c2', { label: 'Firma', type: 'nextcloud', nextcloud: { webdavUrl: 'x', username: 'y', appPassword: 'z' } }))
      .rejects.toThrow(/Typ/)
  })
})

describe('deleteStorageConnection', () => {
  it('verweigert, solange eine Library auf die Verbindung zeigt', async () => {
    h.get.mockResolvedValue(ONEDRIVE)
    h.getUserLibraries.mockResolvedValue([{ id: 'l1', label: 'Klima', storageConnectionId: 'c2' }, { id: 'l2', label: 'Lokal' }])
    await expect(deleteStorageConnection('anna@example.com', 'c2')).rejects.toBeInstanceOf(StorageConnectionInUseError)
    expect(h.del).not.toHaveBeenCalled()
  })

  it('loescht ohne abhaengige Library', async () => {
    h.get.mockResolvedValue(ONEDRIVE)
    await deleteStorageConnection('anna@example.com', 'c2')
    expect(h.del).toHaveBeenCalledWith('anna@example.com', 'c2')
  })
})

describe('testStorageConnection / setOneDriveTokens', () => {
  it('speichert Ergebnis und erneuerte Tokens am Datensatz', async () => {
    h.get.mockResolvedValue(ONEDRIVE)
    h.probe.mockResolvedValue({ ok: true, message: 'Laufwerk erreichbar', onedriveTokens: { accessToken: 'acc2', refreshToken: 'ref2', tokenExpiry: 200 } })
    const s = await testStorageConnection('anna@example.com', 'c2')
    const gespeichert = h.save.mock.calls[0][0] as StorageConnection
    expect(gespeichert.onedrive?.refreshToken).toBe('ref2')
    expect(gespeichert.lastTest?.ok).toBe(true)
    expect(s.lastTest?.message).toBe('Laufwerk erreichbar')
  })

  it('null entfernt die Tokens (Abmelden), die App-Werte bleiben', async () => {
    h.get.mockResolvedValue(ONEDRIVE)
    const s = await setOneDriveTokens('anna@example.com', 'c2', null)
    const gespeichert = h.save.mock.calls[0][0] as StorageConnection
    expect(gespeichert.onedrive).toEqual({ tenantId: 'common', clientId: 'app-1', clientSecret: 'secret-xyz' })
    expect(s.onedrive?.loggedIn).toBe(false)
  })
})
