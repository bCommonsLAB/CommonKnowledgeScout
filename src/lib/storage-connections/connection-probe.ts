/**
 * @fileoverview Verbindungstest einer Speicher-Verbindung (Server, reine Probe).
 *
 * @description
 * Prueft die Zugangsdaten gegen den Dienst, ohne Library und ohne Provider:
 * Nextcloud per PROPFIND auf die WebDAV-Wurzel (wie
 * `NextcloudProvider.validateConfiguration`), OneDrive per Token-Refresh und
 * `GET /me/drive` am Graph. Bewusste Grenze zur Storage-Abstraktion: die
 * Verbindungs-Schicht ist neben den Providern der einzige Ort, der mit dem
 * Backend spricht; ab A2 baut die Factory Provider aus Verbindungen, dann
 * kann der Test ueber `provider.validateConfiguration()` laufen.
 *
 * Die Probe persistiert nichts; neue OneDrive-Tokens gibt sie zurueck, der
 * Service speichert sie.
 */

import { createClient } from 'webdav'
import { normalizeWebdavUrl } from '@/lib/storage/nextcloud-provider'
import type { OneDriveTokens } from '@/lib/storage/onedrive/token-store'
import type { StorageConnection } from '@/types/storage-connection'
import { refreshOneDriveTokens } from './onedrive-login'

export interface ProbeResult {
  ok: boolean
  message: string
  /** Nur OneDrive: erneuerte Tokens, die der Service an der Verbindung speichert. */
  onedriveTokens?: OneDriveTokens
}

async function probeNextcloud(conn: StorageConnection): Promise<ProbeResult> {
  const data = conn.nextcloud
  if (!data) return { ok: false, message: 'Nextcloud-Zugangsdaten fehlen an der Verbindung.' }
  try {
    const client = createClient(normalizeWebdavUrl(data.webdavUrl), {
      username: data.username,
      password: data.appPassword,
    })
    const eintraege = await client.getDirectoryContents('/')
    const anzahl = Array.isArray(eintraege) ? eintraege.length : 0
    return { ok: true, message: `WebDAV erreichbar, Wurzel gelistet (${anzahl} Eintraege).` }
  } catch (error) {
    const status = (error as { status?: number }).status
    const msg = error instanceof Error ? error.message : String(error)
    if (status === 404) {
      return {
        ok: false,
        message:
          `WebDAV-Endpunkt nicht gefunden (404). Erwartetes Format: ` +
          `https://<host>/remote.php/dav/files/<loginname>; Anzeigename statt Loginname ist ein haeufiger Fehler. (${msg})`,
      }
    }
    if (status === 401) {
      return { ok: false, message: `Anmeldung abgelehnt (401): Benutzername oder App-Passwort stimmen nicht. (${msg})` }
    }
    return { ok: false, message: `WebDAV-Verbindung fehlgeschlagen: ${msg}` }
  }
}

async function probeOneDrive(conn: StorageConnection): Promise<ProbeResult> {
  const data = conn.onedrive
  if (!data) return { ok: false, message: 'OneDrive-Zugangsdaten fehlen an der Verbindung.' }
  if (!data.refreshToken) {
    return { ok: false, message: 'Noch nicht bei Microsoft angemeldet — bitte „Anmelden" ausfuehren.' }
  }
  try {
    const tokens = await refreshOneDriveTokens(data)
    const response = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
    if (!response.ok) {
      return { ok: false, message: `Graph antwortet mit HTTP ${response.status} auf /me/drive.`, onedriveTokens: tokens }
    }
    const drive = (await response.json()) as { name?: unknown; driveType?: unknown }
    const name = typeof drive.name === 'string' ? drive.name : 'OneDrive'
    const art = typeof drive.driveType === 'string' ? ` (${drive.driveType})` : ''
    return { ok: true, message: `Angemeldet, Laufwerk „${name}"${art} erreichbar.`, onedriveTokens: tokens }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

/** Testet die Verbindung gegen ihren Dienst; wirft nie, meldet Fehler als `ok: false`. */
export async function probeStorageConnection(conn: StorageConnection): Promise<ProbeResult> {
  switch (conn.type) {
    case 'nextcloud':
      return probeNextcloud(conn)
    case 'onedrive':
      return probeOneDrive(conn)
  }
}
