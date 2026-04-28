/**
 * Characterization Tests fuer src/lib/secretary/client-helpers.ts.
 *
 * Helper wurde in Welle 2.1 Schritt 4 aus client.ts extrahiert
 * (siehe docs/refactor/secretary/04-altlast-pass.md). Tests fixieren
 * das jetzt explizite Verhalten des Token-Sync-Pfads — der frueher
 * von einem `catch {}` verschluckt wurde.
 *
 * Pure Funktion `shouldRefreshOneDriveToken` deterministisch.
 * I/O-Funktionen werden mit `globalThis.fetch` und einem
 * synthetischen `localStorage` getestet.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  readOneDriveTokensFromStorage,
  writeOneDriveTokensToStorage,
  shouldRefreshOneDriveToken,
  syncOneDriveTokensToServer,
} from '@/lib/secretary/client-helpers'

const realFetch = globalThis.fetch

interface MemStore {
  data: Record<string, string>
}

function setupLocalStorage(): MemStore {
  const store: MemStore = { data: {} }
  // jsdom liefert window.localStorage, wir ueberschreiben fuer
  // deterministische Tests.
  const ls = {
    getItem: (k: string) => (k in store.data ? store.data[k] : null),
    setItem: (k: string, v: string) => { store.data[k] = v },
    removeItem: (k: string) => { delete store.data[k] },
    clear: () => { store.data = {} },
    key: () => null,
    length: 0,
  } as unknown as Storage
  ;(globalThis as unknown as { window: Window }).window = {
    localStorage: ls,
  } as unknown as Window
  return store
}

function teardownLocalStorage(): void {
  delete (globalThis as unknown as { window?: Window }).window
}

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  teardownLocalStorage()
  vi.restoreAllMocks()
})

describe('shouldRefreshOneDriveToken (pure)', () => {
  it('liefert true wenn expiryMs = 0', () => {
    expect(shouldRefreshOneDriveToken(0, Date.now())).toBe(true)
  })

  it('liefert true wenn expiryMs NaN', () => {
    expect(shouldRefreshOneDriveToken(NaN, Date.now())).toBe(true)
  })

  it('liefert true wenn expiryMs in den naechsten 2 Min', () => {
    const now = 1_000_000
    const expiry = now + 60_000 // 1 min in der Zukunft
    expect(shouldRefreshOneDriveToken(expiry, now)).toBe(true)
  })

  it('liefert false wenn expiryMs deutlich in der Zukunft', () => {
    const now = 1_000_000
    const expiry = now + 10 * 60_000 // 10 min
    expect(shouldRefreshOneDriveToken(expiry, now)).toBe(false)
  })

  it('respektiert custom-bufferMs', () => {
    const now = 1_000_000
    const expiry = now + 30_000
    expect(shouldRefreshOneDriveToken(expiry, now, 60_000)).toBe(true)
    expect(shouldRefreshOneDriveToken(expiry, now, 10_000)).toBe(false)
  })
})

describe('readOneDriveTokensFromStorage', () => {
  it('liefert null wenn kein window verfuegbar (Server-Pfad)', () => {
    teardownLocalStorage()
    expect(readOneDriveTokensFromStorage('lib-1')).toBeNull()
  })

  it('liefert null wenn kein Eintrag', () => {
    setupLocalStorage()
    expect(readOneDriveTokensFromStorage('lib-1')).toBeNull()
  })

  it('parst gueltigen JSON-Eintrag', () => {
    const store = setupLocalStorage()
    store.data['onedrive_tokens_lib-1'] = JSON.stringify({
      accessToken: 'a',
      refreshToken: 'r',
      expiry: 123,
    })
    const tokens = readOneDriveTokensFromStorage('lib-1')
    expect(tokens?.accessToken).toBe('a')
    expect(tokens?.refreshToken).toBe('r')
    expect(tokens?.expiry).toBe(123)
  })

  it('liefert null bei kaputtem JSON und loggt warn', () => {
    const store = setupLocalStorage()
    store.data['onedrive_tokens_lib-1'] = '{not-json'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(readOneDriveTokensFromStorage('lib-1')).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
  })
})

describe('writeOneDriveTokensToStorage', () => {
  it('schreibt JSON in den Storage', () => {
    const store = setupLocalStorage()
    writeOneDriveTokensToStorage('lib-1', {
      accessToken: 'a',
      refreshToken: 'r',
      expiry: 5,
    })
    const written = JSON.parse(store.data['onedrive_tokens_lib-1'])
    expect(written.accessToken).toBe('a')
  })

  it('ist no-op auf Server (kein window)', () => {
    teardownLocalStorage()
    expect(() =>
      writeOneDriveTokensToStorage('lib-1', {
        accessToken: 'a', refreshToken: 'r', expiry: 1,
      }),
    ).not.toThrow()
  })
})

describe('syncOneDriveTokensToServer', () => {
  it('ist no-op wenn keine Tokens im Storage', async () => {
    setupLocalStorage()
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    await syncOneDriveTokensToServer('lib-1')
    expect(fm).not.toHaveBeenCalled()
  })

  it('persistiert ohne Refresh wenn Token noch gueltig', async () => {
    const store = setupLocalStorage()
    store.data['onedrive_tokens_lib-1'] = JSON.stringify({
      accessToken: 'a', refreshToken: 'r',
      expiry: Date.now() + 30 * 60_000, // 30 min in der Zukunft
    })
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(new Response('{}', { status: 200 }))

    await syncOneDriveTokensToServer('lib-1')

    // Nur PATCH /api/libraries/lib-1/tokens, kein /refresh
    const calls = fm.mock.calls.map((c) => String(c[0]))
    expect(calls.some((u) => u.includes('/refresh'))).toBe(false)
    expect(calls.some((u) => u.includes('/api/libraries/lib-1/tokens'))).toBe(true)
  })

  it('refresht UND persistiert wenn Token abgelaufen', async () => {
    const store = setupLocalStorage()
    store.data['onedrive_tokens_lib-1'] = JSON.stringify({
      accessToken: 'old', refreshToken: 'r-old', expiry: 1, // abgelaufen
    })
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockImplementation(async (url: string) => {
      if (String(url).includes('/refresh')) {
        return new Response(
          JSON.stringify({ accessToken: 'new', refreshToken: 'r-new', expiresIn: 3600 }),
          { status: 200 },
        )
      }
      return new Response('{}', { status: 200 })
    })

    await syncOneDriveTokensToServer('lib-1')

    const refreshCall = fm.mock.calls.find((c) => String(c[0]).includes('/refresh'))
    expect(refreshCall).toBeDefined()
    const persistCall = fm.mock.calls.find((c) =>
      String(c[0]).includes('/api/libraries/lib-1/tokens'),
    )
    expect(persistCall).toBeDefined()
    // localStorage ist mit neuem Token gefuellt
    const updated = JSON.parse(store.data['onedrive_tokens_lib-1'])
    expect(updated.accessToken).toBe('new')
  })

  it('loggt warn bei Refresh-Fehler und wirft NICHT', async () => {
    const store = setupLocalStorage()
    store.data['onedrive_tokens_lib-1'] = JSON.stringify({
      accessToken: 'old', refreshToken: 'r', expiry: 1,
    })
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockImplementation(async (url: string) => {
      if (String(url).includes('/refresh')) {
        return new Response('boom', { status: 500, statusText: 'Server Error' })
      }
      return new Response('{}', { status: 200 })
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(syncOneDriveTokensToServer('lib-1')).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('loggt warn aber wirft NICHT wenn Persist-PATCH 5xx liefert', async () => {
    const store = setupLocalStorage()
    store.data['onedrive_tokens_lib-1'] = JSON.stringify({
      accessToken: 'a', refreshToken: 'r',
      expiry: Date.now() + 30 * 60_000,
    })
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockResolvedValue(
      new Response('boom', { status: 500, statusText: 'fail' }),
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(syncOneDriveTokensToServer('lib-1')).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('loggt warn bei unerwartetem fetch-Throw und wirft NICHT', async () => {
    const store = setupLocalStorage()
    store.data['onedrive_tokens_lib-1'] = JSON.stringify({
      accessToken: 'a', refreshToken: 'r',
      expiry: Date.now() + 30 * 60_000,
    })
    const fm = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fm.mockRejectedValue(new Error('network down'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(syncOneDriveTokensToServer('lib-1')).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })
})
