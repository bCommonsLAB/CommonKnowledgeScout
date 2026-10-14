/**
 * @fileoverview Bindung Library → Speicher-Verbindung (nur Server).
 *
 * @description
 * Plan speicher-verbindungen-und-library-anlage, Teil A, §3 „Auflösung zur
 * Laufzeit": eine Library vom Typ nextcloud oder onedrive zeigt mit
 * `storageConnectionId` auf die Verbindung ihres Besitzers und mit `path` auf
 * das Verzeichnis darauf. Hier wird die Verbindung geladen (entschluesselt,
 * nur im Speicher) und in die Library-Sicht gemischt, aus der die
 * StorageFactory den Provider baut. Fehlt die Bindung: Fehler mit Verweis auf
 * das Migrationsskript, kein Rueckfall auf Altfelder (no-silent-fallbacks).
 */

import { LibraryService } from '@/lib/services/library-service'
import { getStorageConnection } from '@/lib/repositories/storage-connections-repo'
import { MIGRATION_HINWEIS } from '@/lib/storage/onedrive/browser-token-key'
import type { FactoryLibrary } from '@/lib/storage/storage-factory'
import type { Library } from '@/types/library'
import type { StorageConnection } from '@/types/storage-connection'

type LibraryBinding = Pick<Library, 'id' | 'label' | 'type' | 'storageConnectionId'>

/** Nur diese Typen liegen auf einer Verbindung; local hat kein Geheimnis (Owner-Entscheid E1). */
export function requiresStorageConnection(type: string): boolean {
  return type === 'nextcloud' || type === 'onedrive'
}

/**
 * Laedt die Verbindung einer Library (die ihres Besitzers). `ownerEmail` spart
 * die Besitzer-Suche, wenn der Aufrufer ihn schon kennt.
 */
export async function loadLibraryConnection(library: LibraryBinding, ownerEmail?: string): Promise<StorageConnection> {
  if (!requiresStorageConnection(library.type)) {
    throw new Error(`Library "${library.label}" (${library.type}) hat keine Speicher-Verbindung — nur nextcloud und onedrive liegen auf einer.`)
  }
  const connectionId = library.storageConnectionId?.trim() ?? ''
  if (connectionId === '') {
    throw new Error(`Library "${library.label}" ist noch nicht auf eine Speicher-Verbindung umgehaengt. ${MIGRATION_HINWEIS}`)
  }
  const owner = ownerEmail ?? (await LibraryService.getInstance().findOwnerEmailForLibraryId(library.id))
  if (!owner) throw new Error(`Besitzer der Library "${library.label}" nicht gefunden.`)
  const conn = await getStorageConnection(owner, connectionId)
  if (!conn) {
    throw new Error(`Speicher-Verbindung der Library "${library.label}" existiert nicht mehr (Konto ${owner}, Id ${connectionId}).`)
  }
  if (conn.type !== library.type) {
    throw new Error(`Speicher-Verbindung "${conn.label}" ist ${conn.type}, die Library "${library.label}" aber ${library.type}.`)
  }
  return conn
}

/** Zugangsdaten der Verbindung als Provider-Config (nur im Speicher; OneDrive-Tokens laufen ueber den Token-Store). */
export function providerConfigFromConnection(conn: StorageConnection): Record<string, unknown> {
  if (conn.type === 'nextcloud' && conn.nextcloud) {
    const { webdavUrl, username, appPassword } = conn.nextcloud
    return { nextcloud: { webdavUrl, username, appPassword } }
  }
  if (conn.type === 'onedrive' && conn.onedrive) {
    const { tenantId, clientId, clientSecret } = conn.onedrive
    return { tenantId, clientId, clientSecret }
  }
  throw new Error(`Speicher-Verbindung "${conn.label}" traegt keine Zugangsdaten fuer ${conn.type}.`)
}

/**
 * Library-Sicht fuer die StorageFactory im Server-Kontext: wirksamer Pfad,
 * Zugangsdaten aus der Verbindung, Verbindungs-Id und -Stand als
 * Cache-Fingerabdruck ohne Geheimnisse.
 */
export async function toFactoryLibrary(library: Library, effectivePath: string, ownerEmail?: string): Promise<FactoryLibrary> {
  const base: FactoryLibrary = {
    id: library.id,
    label: library.label,
    type: library.type,
    path: effectivePath,
    isEnabled: library.isEnabled,
    config: ((library.config as unknown as Record<string, unknown>) ?? {}),
  }
  if (!requiresStorageConnection(library.type)) return base
  const conn = await loadLibraryConnection(library, ownerEmail)
  return {
    ...base,
    storageConnectionId: conn.id,
    storageConnectionUpdatedAt: conn.updatedAt,
    config: { ...base.config, ...providerConfigFromConnection(conn) },
  }
}
