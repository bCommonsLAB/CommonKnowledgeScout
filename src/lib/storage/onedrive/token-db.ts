/**
 * @fileoverview OneDrive-Token-Store — DB-Implementierung (NUR Server).
 *
 * @description
 * Direkter Funktionsaufruf statt HTTP-Selbst-Aufruf (Testsession 25.08.2026,
 * §2 Punkt 1). Seit Teil A des Plans speicher-verbindungen-und-library-anlage
 * liegen die Tokens an der Speicher-Verbindung der Library (verschluesselt),
 * nicht mehr in der Library-Config: ein Login gilt fuer alle Libraries auf
 * dieser Verbindung. Wird von der StorageFactory im Server-Kontext per
 * dynamischem Import injiziert (MongoDB bleibt aus dem Client-Bundle).
 *
 * @module storage/onedrive
 */

import { LibraryService } from '@/lib/services/library-service'
import { loadLibraryConnection } from '@/lib/storage-connections/library-storage'
import { setOneDriveTokens } from '@/lib/storage-connections/connection-service'
import { refreshOneDriveTokens } from '@/lib/storage-connections/onedrive-login'
import type { OneDriveRefreshResult, OneDriveTokenStore, OneDriveTokens } from './token-store'

/** Library des handelnden Users (Owner oder Mitglied) laden; wirft, wenn unbekannt. */
async function requireLibrary(userEmail: string, libraryId: string) {
  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) throw new Error(`Token-Store: Library nicht gefunden (${libraryId})`)
  return library
}

/**
 * Baut den direkten Token-Store fuer eine Library. `userEmail` ist der
 * handelnde User des Requests; die Tokens gehoeren der Verbindung des
 * Library-Besitzers.
 */
export function createDbTokenStore(userEmail: string, libraryId: string): OneDriveTokenStore {
  return {
    async load(): Promise<OneDriveTokens | null> {
      const library = await requireLibrary(userEmail, libraryId)
      const conn = await loadLibraryConnection(library)
      const data = conn.onedrive
      if (!data?.accessToken || !data.refreshToken) return null
      return { accessToken: data.accessToken, refreshToken: data.refreshToken, tokenExpiry: Number(data.tokenExpiry ?? 0) }
    },

    async refresh(refreshToken: string): Promise<OneDriveRefreshResult> {
      const library = await requireLibrary(userEmail, libraryId)
      const conn = await loadLibraryConnection(library)
      if (!conn.onedrive) throw new Error(`Token-Store: Verbindung "${conn.label}" ist keine OneDrive-Verbindung`)
      const tokens = await refreshOneDriveTokens({ ...conn.onedrive, refreshToken })
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: Math.max(0, tokens.tokenExpiry - Math.floor(Date.now() / 1000)),
      }
    },

    async save(tokens: OneDriveTokens): Promise<void> {
      const library = await requireLibrary(userEmail, libraryId)
      const conn = await loadLibraryConnection(library)
      await setOneDriveTokens(conn.ownerEmail, conn.id, tokens)
    },

    async clear(): Promise<void> {
      const library = await requireLibrary(userEmail, libraryId)
      const conn = await loadLibraryConnection(library)
      await setOneDriveTokens(conn.ownerEmail, conn.id, null)
      // Wie bisher: Provider-Cache leeren, damit kein Provider mit geloeschten
      // Tokens weiterlebt (dynamischer Import gegen Import-Zyklus
      // storage-factory → onedrive-provider → token-db).
      const { StorageFactory } = await import('@/lib/storage/storage-factory')
      await StorageFactory.getInstance().clearProvider(libraryId)
    },
  }
}
