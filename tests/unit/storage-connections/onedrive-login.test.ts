/**
 * OneDrive-Anmeldung an der Verbindung: Authorize-URL, Code-Tausch, Refresh.
 * `fetch` ist gemockt; Redirect-URI kommt aus MS_REDIRECT_URI.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildOneDriveAuthUrl, exchangeOneDriveCode, refreshOneDriveTokens } from '@/lib/storage-connections/onedrive-login'

const APP = { tenantId: 'tenant-1', clientId: 'client-1', clientSecret: 'secret-1' }
const fetchMock = vi.fn()

beforeEach(() => {
  process.env.MS_REDIRECT_URI = 'https://app.example.com/api/auth/onedrive/callback'
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

describe('buildOneDriveAuthUrl', () => {
  it('baut die Authorize-URL mit Tenant, Client, Redirect, Scope und state', () => {
    const url = new URL(buildOneDriveAuthUrl(APP, '{"connectionId":"c1"}'))
    expect(url.pathname).toBe('/tenant-1/oauth2/v2.0/authorize')
    expect(url.searchParams.get('client_id')).toBe('client-1')
    expect(url.searchParams.get('redirect_uri')).toBe(process.env.MS_REDIRECT_URI)
    expect(url.searchParams.get('scope')).toBe('Files.ReadWrite offline_access')
    expect(url.searchParams.get('state')).toBe('{"connectionId":"c1"}')
    expect(url.toString()).not.toContain('secret-1')
  })

  it('wirft ohne MS_REDIRECT_URI und bei unvollstaendiger App', () => {
    delete process.env.MS_REDIRECT_URI
    expect(() => buildOneDriveAuthUrl(APP, 's')).toThrow(/MS_REDIRECT_URI/)
    process.env.MS_REDIRECT_URI = 'https://x'
    expect(() => buildOneDriveAuthUrl({ ...APP, clientId: ' ' }, 's')).toThrow(/Client-ID/)
  })
})

describe('exchangeOneDriveCode / refreshOneDriveTokens', () => {
  it('tauscht den Code und liefert Tokens mit Ablaufzeit', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 60 }) })
    const vorher = Math.floor(Date.now() / 1000)
    const tokens = await exchangeOneDriveCode(APP, 'code-1')
    expect(tokens.accessToken).toBe('a')
    expect(tokens.refreshToken).toBe('r')
    expect(tokens.tokenExpiry).toBeGreaterThanOrEqual(vorher + 60)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token')
    expect(String(init.body)).toContain('grant_type=authorization_code')
    expect(String(init.body)).toContain('code=code-1')
  })

  it('nennt den Secret-ID-Fehler beim Namen', async () => {
    fetchMock.mockResolvedValue({ ok: false, statusText: 'Unauthorized', json: async () => ({ error_description: 'AADSTS7000215: Invalid client secret' }) })
    await expect(exchangeOneDriveCode(APP, 'code')).rejects.toThrow(/Client-Secret-VALUE/)
  })

  it('Refresh ohne Refresh-Token wirft, mit Token sendet er grant_type=refresh_token', async () => {
    await expect(refreshOneDriveTokens(APP)).rejects.toThrow(/anmelden/)
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: 'a2', refresh_token: 'r2', expires_in: 10 }) })
    const tokens = await refreshOneDriveTokens({ ...APP, refreshToken: 'alt' })
    expect(tokens.refreshToken).toBe('r2')
    expect(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)).toContain('refresh_token=alt')
  })
})
