/**
 * Characterization Tests: StorageFactory.getProvider — Provider-Auswahl
 *
 * Welle 1, Schritt 3.
 *
 * Fixiert die in `.cursor/rules/storage-contracts.mdc` §2 + §4 verankerten
 * Vertraege:
 * - `library.type === 'local'` -> LocalStorageProvider (Display-Name "Local Filesystem")
 * - `library.type === 'onedrive'` -> OneDriveProvider (Display-Name "Microsoft OneDrive")
 * - `library.type === 'nextcloud'` (Client-Kontext) -> NextcloudClientProvider (Display-Name "Nextcloud (WebDAV)")
 * - Unbekannter Typ -> wirft mit `errorCode='UNSUPPORTED_LIBRARY_TYPE'` (kein silent fallback)
 * - Unbekannte libraryId -> wirft mit `errorCode='LIBRARY_NOT_FOUND'`
 * - Cache: zweiter Aufruf mit gleicher libraryId liefert dieselbe Instanz
 *
 * Wichtig: `StorageFactory` ist Singleton -> jeder Test setzt eine eigene
 * Library-Liste, damit kein Cross-Test-Bleed entsteht.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StorageFactory } from '@/lib/storage/storage-factory'
import type { ClientLibrary, StorageProviderType } from '@/types/library'

function makeLibrary(id: string, type: StorageProviderType, overrides: Partial<ClientLibrary> = {}): ClientLibrary {
  return {
    id,
    label: `Library ${id}`,
    type,
    path: '',
    isEnabled: true,
    config: {},
    ...overrides,
  }
}

interface FactoryInternals {
  providers: Map<string, unknown>
  libraries: ClientLibrary[]
  serverContext: boolean
  userEmail: string | null
  apiBaseUrl: string | null
}

function resetSingleton(): void {
  const factory = StorageFactory.getInstance() as unknown as FactoryInternals
  factory.providers.clear()
  factory.libraries = []
  factory.serverContext = false
  factory.userEmail = null
  factory.apiBaseUrl = null
}

beforeEach(resetSingleton)
afterEach(resetSingleton)

describe('StorageFactory.getProvider — Provider-Auswahl je library.type', () => {
  it('liefert LocalStorageProvider fuer library.type="local"', async () => {
    const factory = StorageFactory.getInstance()
    factory.setLibraries([makeLibrary('lib-local', 'local')])

    const provider = await factory.getProvider('lib-local')

    expect(provider.name).toBe('Local Filesystem')
    expect(provider.id).toBe('lib-local')
    expect(provider.isAuthenticated()).toBe(true)
  })

  it('liefert OneDriveProvider fuer library.type="onedrive"', async () => {
    const factory = StorageFactory.getInstance()
    factory.setLibraries([makeLibrary('lib-onedrive', 'onedrive')])

    const provider = await factory.getProvider('lib-onedrive')

    expect(provider.name).toBe('Microsoft OneDrive')
    expect(provider.id).toBe('lib-onedrive')
  })

  it('liefert NextcloudClientProvider im Client-Kontext fuer library.type="nextcloud"', async () => {
    const factory = StorageFactory.getInstance()
    factory.setLibraries([makeLibrary('lib-nextcloud', 'nextcloud')])

    const provider = await factory.getProvider('lib-nextcloud')

    expect(provider.name).toBe('Nextcloud (WebDAV)')
    expect(provider.id).toBe('lib-nextcloud')
  })

  it('cached die Provider-Instanz pro libraryId', async () => {
    const factory = StorageFactory.getInstance()
    factory.setLibraries([makeLibrary('lib-cached', 'local')])

    const a = await factory.getProvider('lib-cached')
    const b = await factory.getProvider('lib-cached')

    expect(a).toBe(b)
  })

  it('wirft LibraryNotFoundError mit errorCode bei unbekannter libraryId', async () => {
    const factory = StorageFactory.getInstance()
    factory.setLibraries([makeLibrary('lib-known', 'local')])

    let caught: unknown
    try {
      await factory.getProvider('lib-unknown')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(Error)
    expect(caught).toMatchObject({
      name: 'LibraryNotFoundError',
      errorCode: 'LIBRARY_NOT_FOUND',
      libraryId: 'lib-unknown',
    })
  })

  it('wirft UnsupportedLibraryTypeError statt einen stillen Fallback zu nehmen', async () => {
    const factory = StorageFactory.getInstance()
    const exotic = makeLibrary('lib-exotic', 'local')
    ;(exotic as unknown as { type: string }).type = 'gdrive'
    factory.setLibraries([exotic])

    let caught: unknown
    try {
      await factory.getProvider('lib-exotic')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(Error)
    expect(caught).toMatchObject({
      name: 'UnsupportedLibraryTypeError',
      errorCode: 'UNSUPPORTED_LIBRARY_TYPE',
      libraryType: 'gdrive',
      libraryId: 'lib-exotic',
    })
  })

  it('setLibraries([]) loescht den Provider-Cache NICHT (dokumentierter Sonderfall)', async () => {
    const factory = StorageFactory.getInstance()
    factory.setLibraries([makeLibrary('lib-keep', 'local')])
    const before = await factory.getProvider('lib-keep')

    factory.setLibraries([])
    const after = await factory.getProvider('lib-keep')

    expect(after).toBe(before)
  })
})
