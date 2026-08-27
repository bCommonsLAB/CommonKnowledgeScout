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
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OneDriveProvider } from '@/lib/storage/onedrive-provider'
import { StorageError } from '@/lib/storage/types'
import type { ClientLibrary } from '@/types/library'

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

function providerMitTokens(): { provider: OneDriveProvider; internals: ProviderInternals; clear: ReturnType<typeof vi.fn> } {
  const provider = new OneDriveProvider(makeLibrary())
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
  vi.stubGlobal('fetch', fetchMock)
})

function antwort(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('refreshAccessToken — wann die Anmeldung geloescht wird', () => {
  it('behaelt die Anmeldung bei einem Netzwerkfehler (der gemessene Fall)', async () => {
    const { internals, clear } = providerMitTokens()
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(internals.refreshAccessToken()).rejects.toThrow(/fetch failed/)
    expect(clear).not.toHaveBeenCalled()
  })

  it('behaelt die Anmeldung, wenn die eigene Route 502 ohne invalid_grant meldet', async () => {
    const { internals, clear } = providerMitTokens()
    fetchMock.mockResolvedValueOnce(
      antwort(502, { error: 'Token-Refresh fehlgeschlagen', details: 'Gateway weg', code: null }),
    )

    await expect(internals.refreshAccessToken()).rejects.toThrow(/BLEIBT erhalten/)
    expect(clear).not.toHaveBeenCalled()
  })

  it('loescht die Anmeldung bei invalid_grant — dann ist das Refresh-Token wirklich tot', async () => {
    const { internals, clear } = providerMitTokens()
    fetchMock.mockResolvedValueOnce(
      antwort(502, { error: 'Token-Refresh fehlgeschlagen', details: '{"error":"invalid_grant"}', code: 'invalid_grant' }),
    )

    await expect(internals.refreshAccessToken()).rejects.toThrow(StorageError)
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('behaelt die Anmeldung, wenn gar kein Refresh-Token da ist', async () => {
    const { internals, clear } = providerMitTokens()
    internals.refreshToken = null

    await expect(internals.refreshAccessToken()).rejects.toThrow(/Kein Refresh-Token/)
    expect(clear).not.toHaveBeenCalled()
  })
})
