/**
 * @fileoverview Regressions-Tests: Token-Refresh loescht die Anmeldung nur bei
 * echter Ablehnung.
 *
 * Befund 27.08.2026 (Produktiv-Daten): Der Dev-Server lief auf einem anderen
 * Port als `INTERNAL_SELF_BASE_URL`. Der Selbst-Aufruf des Token-Refresh lief
 * ins Leere, der `catch` warf daraufhin `clearTokens()` — die OneDrive-Anmeldung
 * war aus der Datenbank geloescht, obwohl nur ein Netzwerkfehler vorlag.
 *
 * Regel seither: Geloescht wird ausschliesslich bei `invalid_grant` (der
 * OAuth-Code fuer „dieses Refresh-Token ist tot").
 *
 * Seit Teil A (Speicher-Verbindungen) erneuert der Server direkt ueber den
 * Token-Store (`refresh`), ohne HTTP-Selbst-Aufruf; diese Tests laufen im
 * Server-Kontext und pruefen dieselbe Regel an diesem Weg.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OneDriveProvider } from '@/lib/storage/onedrive-provider'
import { StorageError } from '@/lib/storage/types'
import type { ClientLibrary } from '@/types/library'
import type { OneDriveTokenStore } from '@/lib/storage/onedrive/token-store'

interface ProviderInternals {
  accessToken: string | null
  refreshToken: string | null
  tokenExpiry: number
  authenticated: boolean
  refreshPromise: Promise<void> | null
  clearTokens: () => Promise<void>
  refreshAccessToken: () => Promise<void>
}

function makeLibrary(): ClientLibrary {
  return {
    id: 'lib-refresh', label: 'Refresh-Test', type: 'onedrive', path: '', isEnabled: true, config: {},
  }
}

const refreshMock = vi.fn<OneDriveTokenStore['refresh']>()

function providerMitTokens(): { provider: OneDriveProvider; internals: ProviderInternals; clear: ReturnType<typeof vi.fn> } {
  const provider = new OneDriveProvider(makeLibrary())
  provider.setTokenStore({ load: vi.fn(), save: vi.fn().mockResolvedValue(undefined), clear: vi.fn(), refresh: refreshMock })
  const internals = provider as unknown as ProviderInternals
  internals.accessToken = 'alt-access'
  internals.refreshToken = 'alt-refresh'
  internals.tokenExpiry = Date.now() - 1000
  internals.authenticated = true
  internals.refreshPromise = null
  const clear = vi.fn().mockResolvedValue(undefined)
  internals.clearTokens = clear
  return { provider, internals, clear }
}

const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  fetchMock.mockReset()
  refreshMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

/** Fehler wie aus refreshOneDriveTokens: OAuth-Code am Fehler. */
function oauthFehler(message: string, code: string | null): Error {
  return Object.assign(new Error(message), { code })
}

describe('refreshAccessToken — wann die Anmeldung geloescht wird', () => {
  it('behaelt die Anmeldung bei einem Netzwerkfehler (der gemessene Fall)', async () => {
    const { internals, clear } = providerMitTokens()
    refreshMock.mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(internals.refreshAccessToken()).rejects.toThrow(/fetch failed/)
    expect(clear).not.toHaveBeenCalled()
  })

  it('behaelt die Anmeldung, wenn Microsoft ohne invalid_grant ablehnt', async () => {
    const { internals, clear } = providerMitTokens()
    refreshMock.mockRejectedValueOnce(oauthFehler('Token-Austausch fehlgeschlagen: Gateway weg', null))

    await expect(internals.refreshAccessToken()).rejects.toThrow(/BLEIBT erhalten/)
    expect(clear).not.toHaveBeenCalled()
  })

  it('loescht die Anmeldung bei invalid_grant — dann ist das Refresh-Token wirklich tot', async () => {
    const { internals, clear } = providerMitTokens()
    refreshMock.mockRejectedValueOnce(oauthFehler('Token-Austausch fehlgeschlagen: AADSTS70000', 'invalid_grant'))

    await expect(internals.refreshAccessToken()).rejects.toThrow(StorageError)
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('behaelt die Anmeldung, wenn gar kein Refresh-Token da ist', async () => {
    const { internals, clear } = providerMitTokens()
    internals.refreshToken = null

    await expect(internals.refreshAccessToken()).rejects.toThrow(/Kein Refresh-Token/)
    expect(clear).not.toHaveBeenCalled()
  })

  it('speichert erneuerte Tokens ueber den Token-Store, ohne HTTP-Selbst-Aufruf', async () => {
    const { internals } = providerMitTokens()
    refreshMock.mockResolvedValueOnce({ accessToken: 'neu-access', refreshToken: 'neu-refresh', expiresIn: 3600 })

    await internals.refreshAccessToken()
    expect(refreshMock).toHaveBeenCalledWith('alt-refresh')
    expect(internals.accessToken).toBe('neu-access')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
