/**
 * @fileoverview Callback der OneDrive-Anmeldung fuer eine Speicher-Verbindung.
 *
 * Wird von `src/app/api/auth/onedrive/callback/route.ts` gerufen, sobald der
 * `state` eine `connectionId` traegt (statt der Library-Id des Alt-Flows).
 * Tauscht den Code, speichert die Tokens an der Verbindung und liefert den
 * Rueckweg zur Konto-Seite mit `?onedrive=ok|error` (Fehlertext ohne Geheimnis).
 */

import { FileLogger } from '@/lib/debug/logger'
import { exchangeOneDriveCode } from './onedrive-login'
import { requireStorageConnection, setOneDriveTokens } from './connection-service'

export const STORAGE_CONNECTIONS_PATH = '/settings/account/storage-connections'

export interface OneDriveConnectionCallbackInput {
  userEmail: string
  connectionId: string
  code: string | null
  error: string | null
  errorDescription: string | null
  /** Rueckweg aus dem `state`; fehlt er, geht es auf die Konto-Seite. */
  redirect: string | null
  baseUrl: string
}

function rueckweg(input: OneDriveConnectionCallbackInput, params: Record<string, string>): URL {
  const url = new URL(input.redirect || STORAGE_CONNECTIONS_PATH, input.baseUrl)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url
}

/** Liefert die URL, auf die der Browser nach dem Login geschickt wird. */
export async function handleOneDriveConnectionCallback(input: OneDriveConnectionCallbackInput): Promise<URL> {
  if (input.error) {
    return rueckweg(input, { onedrive: 'error', message: `${input.error}: ${input.errorDescription ?? ''}`.trim() })
  }
  if (!input.code) {
    return rueckweg(input, { onedrive: 'error', message: 'Microsoft hat keinen Code geliefert.' })
  }
  try {
    const conn = await requireStorageConnection(input.userEmail, input.connectionId)
    if (!conn.onedrive) {
      return rueckweg(input, { onedrive: 'error', message: 'Die Verbindung ist keine OneDrive-Verbindung.' })
    }
    const tokens = await exchangeOneDriveCode(conn.onedrive, input.code)
    await setOneDriveTokens(input.userEmail, input.connectionId, tokens)
    return rueckweg(input, { onedrive: 'ok', connectionId: input.connectionId })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    FileLogger.error('storage-connections', 'OneDrive-Callback fehlgeschlagen', { connectionId: input.connectionId, error: message })
    return rueckweg(input, { onedrive: 'error', message })
  }
}
