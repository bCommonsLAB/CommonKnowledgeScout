/**
 * @fileoverview Speicher-Verbindung einer Library fuer `speicher_pruefen`
 * (Plan speicher-verbindungen-und-library-anlage, Teil A): Bezeichnung, bei
 * Nextcloud URL und Benutzer, ob ein Geheimnis hinterlegt ist, bei OneDrive
 * ob angemeldet — nie Werte. Fehlt die Bindung, steht der Grund in `fehler`.
 *
 * @module mcp
 */

import { loadLibraryConnection } from '@/lib/storage-connections/library-storage'
import type { Library } from '@/types/library'

export type SpeicherVerbindungInfo =
  | { bezeichnung: string; webdavUrl?: string; benutzer?: string; geheimnisHinterlegt: boolean; angemeldet?: boolean }
  | { fehler: string }

/** `null` fuer Libraries ohne Verbindung (local). */
export async function beschreibeSpeicherVerbindung(library: Library): Promise<SpeicherVerbindungInfo | null> {
  if (library.type !== 'nextcloud' && library.type !== 'onedrive') return null
  try {
    const conn = await loadLibraryConnection(library)
    return {
      bezeichnung: conn.label,
      ...(conn.nextcloud ? { webdavUrl: conn.nextcloud.webdavUrl, benutzer: conn.nextcloud.username } : {}),
      geheimnisHinterlegt: conn.nextcloud ? conn.nextcloud.appPassword !== '' : Boolean(conn.onedrive?.clientSecret),
      ...(conn.onedrive ? { angemeldet: Boolean(conn.onedrive.refreshToken) } : {}),
    }
  } catch (error) {
    return { fehler: error instanceof Error ? error.message : String(error) }
  }
}
