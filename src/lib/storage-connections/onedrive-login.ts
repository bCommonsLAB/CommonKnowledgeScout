/**
 * @fileoverview OneDrive-Anmeldung an einer Speicher-Verbindung (Server).
 *
 * @description
 * Dasselbe Protokoll wie `src/lib/storage/onedrive/oauth-server.ts`, nur an
 * der Verbindung statt an der Library: Authorization-Code-Flow gegen
 * `login.microsoftonline.com`, Tokens landen verschluesselt am Datensatz der
 * Verbindung (Plan Teil A, §3 „Auflösung zur Laufzeit", Punkt 3: ein Login
 * gilt fuer alle Libraries auf dieser Verbindung). Redirect-URI kommt aus
 * `MS_REDIRECT_URI`; fehlt sie, wird laut geworfen.
 *
 * Geheimnisse werden nie geloggt.
 */

import type { OneDriveTokens } from '@/lib/storage/onedrive/token-store'
import type { OneDriveConnectionData } from '@/types/storage-connection'
import { StorageConnectionInputError } from './errors'

const SCOPE = 'Files.ReadWrite offline_access'

/** Redirect-URI der Azure-App aus der Umgebung; ohne sie gibt es keinen Login. */
function requireOneDriveRedirectUri(): string {
  const uri = process.env.MS_REDIRECT_URI?.trim() ?? ''
  if (uri === '') {
    throw new Error('MS_REDIRECT_URI ist nicht gesetzt — ohne Redirect-URI keine OneDrive-Anmeldung.')
  }
  return uri
}

function requireAppValues(data: OneDriveConnectionData): { tenantId: string; clientId: string; clientSecret: string } {
  const tenantId = data.tenantId.trim()
  const clientId = data.clientId.trim()
  const clientSecret = data.clientSecret.trim()
  const fehlend = [!tenantId && 'Tenant-ID', !clientId && 'Client-ID', !clientSecret && 'Client-Secret'].filter(Boolean)
  if (fehlend.length > 0) {
    throw new StorageConnectionInputError(`OneDrive-Verbindung unvollstaendig: ${fehlend.join(', ')} fehlt.`)
  }
  return { tenantId, clientId, clientSecret }
}

/** Authorize-URL mit `state`; der Aufrufer baut `state` (Verbindungs-Id plus Rueckweg). */
export function buildOneDriveAuthUrl(data: OneDriveConnectionData, state: string): string {
  const { tenantId, clientId } = requireAppValues(data)
  const redirectUri = requireOneDriveRedirectUri()
  const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_mode', 'query')
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('state', state)
  return url.toString()
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

/** Fehlertext des Token-Endpunkts; der haeufige Fall „Secret-ID statt Secret-Value" bekommt einen Hinweis. */
function tokenFehlertext(body: TokenResponse, statusText: string): string {
  const beschreibung = body.error_description || body.error || statusText
  if (beschreibung.includes('AADSTS7000215') || beschreibung.includes('Invalid client secret')) {
    return (
      'Ungueltiges Client-Secret. Bitte den Client-Secret-VALUE verwenden (der lange String beim Erzeugen), ' +
      `nicht die Secret-ID im GUID-Format. Original: ${beschreibung}`
    )
  }
  return beschreibung
}

async function requestTokens(data: OneDriveConnectionData, grant: Record<string, string>): Promise<OneDriveTokens> {
  const { tenantId, clientId, clientSecret } = requireAppValues(data)
  const redirectUri = requireOneDriveRedirectUri()
  const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, ...grant })
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const body = (await response.json().catch(() => ({}))) as TokenResponse
  if (!response.ok) {
    throw new Error(`Token-Austausch fehlgeschlagen: ${tokenFehlertext(body, response.statusText)}`)
  }
  if (!body.access_token || !body.refresh_token) {
    throw new Error('Token-Austausch ohne Access- oder Refresh-Token — Antwort von Microsoft unvollstaendig.')
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    tokenExpiry: Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600),
  }
}

/** Authorization-Code gegen Tokens tauschen (Callback). */
export function exchangeOneDriveCode(data: OneDriveConnectionData, code: string): Promise<OneDriveTokens> {
  return requestTokens(data, { code, grant_type: 'authorization_code' })
}

/** Tokens mit dem Refresh-Token erneuern (Test, spaeter Laufzeit in A2). */
export async function refreshOneDriveTokens(data: OneDriveConnectionData): Promise<OneDriveTokens> {
  const refreshToken = data.refreshToken?.trim() ?? ''
  if (refreshToken === '') {
    throw new Error('Kein Refresh-Token an der Verbindung — bitte zuerst bei Microsoft anmelden.')
  }
  return requestTokens(data, { refresh_token: refreshToken, grant_type: 'refresh_token' })
}
