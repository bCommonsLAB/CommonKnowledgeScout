/**
 * @fileoverview OneDrive-Token-Store — DB-Implementierung (NUR Server).
 *
 * @description
 * Direkter Funktionsaufruf statt HTTP-Selbst-Aufruf (Testsession 25.08.2026,
 * §2 Punkt 1): exakt die Logik der Route `/api/libraries/[id]/tokens`
 * (GET/PATCH/DELETE mit `X-Internal-Request`), nur ohne den Umweg ueber den
 * eigenen Next-Server — kein Roundtrip, keine Abhaengigkeit von
 * `INTERNAL_SELF_BASE_URL`. Wird von der StorageFactory im Server-Kontext
 * per dynamischem Import injiziert (MongoDB bleibt aus dem Client-Bundle).
 *
 * @module storage/onedrive
 */

import { LibraryService } from '@/lib/services/library-service'
import type { OneDriveTokenStore, OneDriveTokens } from './token-store'

/** Library des Users laden — gleiche Aufloesung wie die Token-Route (Owner-Eintraege). */
async function findLibrary(userEmail: string, libraryId: string) {
  const libraries = await LibraryService.getInstance().getUserLibraries(userEmail)
  return libraries.find((library) => library.id === libraryId) ?? null
}

/**
 * Baut den direkten Token-Store fuer eine Library. `userEmail` ist der
 * handelnde User des Requests (die Factory kennt ihn) — dieselbe Identitaet,
 * die vorher als `?email=` am Selbst-Aufruf hing.
 */
export function createDbTokenStore(userEmail: string, libraryId: string): OneDriveTokenStore {
  return {
    async load(): Promise<OneDriveTokens | null> {
      const library = await findLibrary(userEmail, libraryId)
      if (!library) return null
      const cfg = library.config as unknown as Record<string, unknown> | undefined
      const accessToken = typeof cfg?.accessToken === 'string' ? cfg.accessToken : ''
      const refreshToken = typeof cfg?.refreshToken === 'string' ? cfg.refreshToken : ''
      if (!accessToken || !refreshToken) return null
      return { accessToken, refreshToken, tokenExpiry: Number(cfg?.tokenExpiry ?? 0) }
    },

    async save(tokens: OneDriveTokens): Promise<void> {
      const library = await findLibrary(userEmail, libraryId)
      if (!library) throw new Error(`Token-Speichern: Library nicht gefunden (${libraryId})`)
      const cfg: Record<string, unknown> = { ...(library.config ?? {}) }
      cfg.accessToken = tokens.accessToken
      cfg.refreshToken = tokens.refreshToken
      cfg.tokenExpiry = tokens.tokenExpiry
      library.config = cfg as typeof library.config
      const ok = await LibraryService.getInstance().updateLibrary(userEmail, library)
      if (!ok) throw new Error(`Token-Speichern fehlgeschlagen (${libraryId})`)
    },

    async clear(): Promise<void> {
      const library = await findLibrary(userEmail, libraryId)
      if (!library) throw new Error(`Token-Loeschen: Library nicht gefunden (${libraryId})`)
      if (library.config) {
        const cfg = library.config as unknown as Record<string, unknown>
        delete cfg.accessToken
        delete cfg.refreshToken
        delete cfg.tokenExpiry
        library.config = cfg as typeof library.config
      }
      const ok = await LibraryService.getInstance().updateLibrary(userEmail, library)
      if (!ok) throw new Error(`Token-Loeschen fehlgeschlagen (${libraryId})`)
      // Wie die DELETE-Route: Provider-Cache leeren, damit kein Provider mit
      // geloeschten Tokens weiterlebt (dynamischer Import gegen Import-Zyklus
      // storage-factory → onedrive-provider → token-db).
      const { StorageFactory } = await import('@/lib/storage/storage-factory')
      await StorageFactory.getInstance().clearProvider(libraryId)
    },
  }
}
