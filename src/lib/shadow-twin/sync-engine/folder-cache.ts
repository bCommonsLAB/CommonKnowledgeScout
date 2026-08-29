/**
 * @fileoverview Geteilter In-Memory-Cache fuer listItemsById-Ergebnisse.
 *
 * @description
 * Vermeidet redundante Storage-API-Aufrufe (OneDrive/WebDAV) fuer denselben
 * Ordner innerhalb EINES Engine-Laufs. Konsolidiert die bisher doppelte
 * lokale Implementierung aus sync-all/route.ts und migrate/route.ts
 * (die Duplikate fallen mit PR D weg).
 *
 * @module shadow-twin/sync-engine
 */

import type { StorageItem, StorageProvider } from '@/lib/storage/types'

export class FolderCache {
  private cache = new Map<string, StorageItem[]>()
  /**
   * Laufende Listings. Seit der Scan der Engine nebenlaeufig ist, koennen zwei
   * Aufrufer denselben Ordner gleichzeitig anfragen — ohne diese Karte wuerden
   * beide den Storage treffen, und der Cache haette genau dann nicht gegriffen,
   * wenn es am meisten kostet. Fehlschlaege werden NICHT gecached: die Karte
   * wird in `finally` geraeumt, der naechste Aufruf fragt neu.
   */
  private inFlight = new Map<string, Promise<StorageItem[]>>()

  constructor(private provider: StorageProvider) {}

  async list(folderId: string): Promise<StorageItem[]> {
    const cached = this.cache.get(folderId)
    if (cached) return cached
    const laufend = this.inFlight.get(folderId)
    if (laufend) return laufend
    const anfrage = this.provider
      .listItemsById(folderId)
      .then((items) => {
        this.cache.set(folderId, items)
        return items
      })
      .finally(() => {
        this.inFlight.delete(folderId)
      })
    this.inFlight.set(folderId, anfrage)
    return anfrage
  }

  /** Cache fuer einen Ordner invalidieren (nach Schreib-/Loeschvorgang). */
  invalidate(folderId: string): void {
    this.cache.delete(folderId)
    this.inFlight.delete(folderId)
  }
}
