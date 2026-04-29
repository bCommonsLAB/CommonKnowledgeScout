/**
 * Characterization Tests: OneDriveProvider Fehler-Pfade
 *
 * Welle 1, Schritt 3.
 *
 * Diese Tests fixieren die Fehler-Semantik aus
 * `.cursor/rules/storage-contracts.mdc` §2:
 * - `getItemById('')` -> StorageError "INVALID_INPUT"
 * - `deleteItem('root')` -> StorageError "INVALID_OPERATION"
 * - `moveItem('root', _)` -> StorageError "INVALID_OPERATION"
 * - `renameItem('root', _)` -> StorageError "INVALID_OPERATION"
 * - Operationen ohne Tokens -> StorageError "AUTH_REQUIRED"
 *
 * Damit ist der Modul-Split in Schritt 4 (`onedrive/items.ts`,
 * `onedrive/auth.ts`) gegen Drift abgesichert.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OneDriveProvider } from '@/lib/storage/onedrive-provider'
import { StorageError } from '@/lib/storage/types'
import type { ClientLibrary } from '@/types/library'

interface ProviderInternals {
  accessToken: string | null
  refreshToken: string | null
  tokenExpiry: number
  authenticated: boolean
  baseFolderId: string | null
  basePath: string
}

function makeLibrary(overrides: Partial<ClientLibrary> = {}): ClientLibrary {
  return {
    id: 'lib-onedrive-errors',
    label: 'OneDrive Error-Path Test',
    type: 'onedrive',
    path: '',
    isEnabled: true,
    config: {},
    ...overrides,
  }
}

function authenticate(provider: OneDriveProvider): void {
  const internals = provider as unknown as ProviderInternals
  internals.accessToken = 'fake-access-token'
  internals.refreshToken = 'fake-refresh-token'
  internals.tokenExpiry = Date.now() + 60 * 60 * 1000
  internals.authenticated = true
  internals.baseFolderId = 'root'
  internals.basePath = ''
}

const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function expectStorageErrorWithCode(promise: Promise<unknown>, code: string): Promise<void> {
  let caught: unknown
  try {
    await promise
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(StorageError)
  expect(caught).toMatchObject({ code })
}

describe('OneDriveProvider error paths', () => {
  it('getItemById wirft "INVALID_INPUT" bei leerer Item-ID', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)

    await expectStorageErrorWithCode(provider.getItemById(''), 'INVALID_INPUT')
    await expectStorageErrorWithCode(provider.getItemById('   '), 'INVALID_INPUT')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deleteItem wirft "INVALID_OPERATION" fuer "root"', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)

    await expectStorageErrorWithCode(provider.deleteItem('root'), 'INVALID_OPERATION')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('moveItem wirft "INVALID_OPERATION" fuer "root"', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)

    await expectStorageErrorWithCode(provider.moveItem('root', 'somewhere'), 'INVALID_OPERATION')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renameItem wirft "INVALID_OPERATION" fuer "root"', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)

    await expectStorageErrorWithCode(provider.renameItem('root', 'NewName'), 'INVALID_OPERATION')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('isAuthenticated() liefert true nach gesetzten Tokens und false ohne Tokens', () => {
    const authedProvider = new OneDriveProvider(makeLibrary())
    authenticate(authedProvider)
    expect(authedProvider.isAuthenticated()).toBe(true)

    const unauthedProvider = new OneDriveProvider(makeLibrary({ id: 'lib-no-tokens', config: {} }))
    expect(unauthedProvider.isAuthenticated()).toBe(false)
  })

  it('isAuthenticated() laedt OAuth-Session synchron aus localStorage (kein In-Memory-Token)', () => {
    // Browser simulieren: tryHydrateTokensFromLocalStorage laeuft nur mit window + localStorage
    const store: Record<string, string> = {}
    const ls = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k]
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() {
        return Object.keys(store).length
      },
    } as Storage
    vi.stubGlobal('localStorage', ls)
    // Minimaler Browser-Stub: localStorage + globales fetch (loadOAuthDefaults im Konstruktor)
    vi.stubGlobal('window', { ...globalThis, localStorage: ls } as unknown as Window)
    const libId = 'lib-ls-hydrate-only'
    ls.setItem(
      `onedrive_tokens_${libId}`,
      JSON.stringify({
        accessToken: 'from-localstorage',
        refreshToken: 'refresh-ls',
        expiry: Date.now() + 3_600_000,
      }),
    )
    const provider = new OneDriveProvider(makeLibrary({ id: libId, config: {} }))
    expect(provider.isAuthenticated()).toBe(true)
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('listItemsById ohne Tokens wirft StorageError "AUTH_REQUIRED"', async () => {
    const provider = new OneDriveProvider(makeLibrary({ id: 'lib-unauth', config: {} }))
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'no token' }), { status: 401 }),
    )

    let caught: unknown
    try {
      await provider.listItemsById('any-folder')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(StorageError)
    expect(caught).toMatchObject({ code: 'AUTH_REQUIRED' })
  })
})
