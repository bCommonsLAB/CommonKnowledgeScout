/**
 * StorageFactory — Cache-Fingerabdruck bei Speicher-Verbindungen (Teil A des
 * Plans speicher-verbindungen-und-library-anlage): der Schluessel haengt an
 * Verbindungs-Id und -Stand, nie an den Geheimnissen der Config.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StorageFactory } from '@/lib/storage/storage-factory'
import type { ClientLibrary, StorageProviderType } from '@/types/library'

function makeLibrary(id: string, type: StorageProviderType, overrides: Partial<ClientLibrary> = {}): ClientLibrary {
  return { id, label: `Library ${id}`, type, path: '', isEnabled: true, config: {}, ...overrides }
}

function resetSingleton(): void {
  const factory = StorageFactory.getInstance() as unknown as { providers: Map<string, unknown>; libraries: ClientLibrary[]; serverContext: boolean }
  factory.providers.clear()
  factory.libraries = []
  factory.serverContext = false
}

beforeEach(resetSingleton)
afterEach(resetSingleton)

describe('StorageFactory — Cache-Fingerabdruck bei Speicher-Verbindungen (Teil A)', () => {
  it('haengt an Verbindungs-Id und -Stand, nicht an den Geheimnissen in der Config', async () => {
    const factory = StorageFactory.getInstance()
    const cfg = (appPassword: string) => ({ nextcloud: { webdavUrl: 'https://nc.test', username: 'u', appPassword } })
    const mitVerbindung = (appPassword: string, stand: string) => ({
      ...makeLibrary('lib-conn', 'nextcloud', { config: cfg(appPassword) }),
      storageConnectionId: 'c1',
      storageConnectionUpdatedAt: stand,
    })
    factory.setLibraries([mitVerbindung('secret-1', 'U1')])
    const erster = await factory.getProvider('lib-conn')
    factory.setLibraries([mitVerbindung('secret-1', 'U1')])
    expect(await factory.getProvider('lib-conn')).toBe(erster)
    factory.setLibraries([mitVerbindung('secret-1', 'U2')])
    expect(await factory.getProvider('lib-conn')).not.toBe(erster)
    const key = (factory as unknown as { providerConfigKeys: Map<string, string> }).providerConfigKeys.get('lib-conn') ?? ''
    expect(key).not.toContain('secret-1')
  })
})

