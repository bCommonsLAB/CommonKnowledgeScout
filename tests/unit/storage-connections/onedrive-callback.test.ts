/**
 * Callback der OneDrive-Anmeldung an der Verbindung: Fehler von Microsoft,
 * fehlender Code, Erfolg (Tokens gespeichert), Rueckweg mit Status-Parameter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ require: vi.fn(), setTokens: vi.fn(), exchange: vi.fn() }))
vi.mock('@/lib/storage-connections/connection-service', () => ({ requireStorageConnection: h.require, setOneDriveTokens: h.setTokens }))
vi.mock('@/lib/storage-connections/onedrive-login', () => ({ exchangeOneDriveCode: h.exchange }))
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import { handleOneDriveConnectionCallback } from '@/lib/storage-connections/onedrive-callback'

const BASIS = { userEmail: 'anna@example.com', connectionId: 'c1', code: 'code', error: null, errorDescription: null, redirect: null, baseUrl: 'https://app.example.com' }

beforeEach(() => vi.resetAllMocks())

describe('handleOneDriveConnectionCallback', () => {
  it('Fehler von Microsoft → Rueckweg mit onedrive=error, nichts gespeichert', async () => {
    const url = await handleOneDriveConnectionCallback({ ...BASIS, code: null, error: 'access_denied', errorDescription: 'Abgelehnt' })
    expect(url.pathname).toBe('/settings/account/storage-connections')
    expect(url.searchParams.get('onedrive')).toBe('error')
    expect(url.searchParams.get('message')).toContain('access_denied')
    expect(h.setTokens).not.toHaveBeenCalled()
  })

  it('Erfolg → Tokens an der Verbindung, Rueckweg mit onedrive=ok', async () => {
    h.require.mockResolvedValue({ id: 'c1', onedrive: { tenantId: 't', clientId: 'c', clientSecret: 's' } })
    h.exchange.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', tokenExpiry: 1 })
    const url = await handleOneDriveConnectionCallback({ ...BASIS, redirect: '/settings/account/storage-connections' })
    expect(h.setTokens).toHaveBeenCalledWith('anna@example.com', 'c1', { accessToken: 'a', refreshToken: 'r', tokenExpiry: 1 })
    expect(url.searchParams.get('onedrive')).toBe('ok')
    expect(url.searchParams.get('connectionId')).toBe('c1')
  })

  it('Tausch schlaegt fehl → onedrive=error mit Fehlertext', async () => {
    h.require.mockResolvedValue({ id: 'c1', onedrive: { tenantId: 't', clientId: 'c', clientSecret: 's' } })
    h.exchange.mockRejectedValue(new Error('Token-Austausch fehlgeschlagen: kaputt'))
    const url = await handleOneDriveConnectionCallback(BASIS)
    expect(url.searchParams.get('onedrive')).toBe('error')
    expect(url.searchParams.get('message')).toContain('kaputt')
  })
})
