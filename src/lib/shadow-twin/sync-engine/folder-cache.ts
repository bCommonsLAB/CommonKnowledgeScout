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

  constructor(private provider: StorageProvider) {}

  async list(folderId: string): Promise<StorageItem[]> {
    const cached = this.cache.get(folderId)
    if (cached) return cached
    const items = await this.provider.listItemsById(folderId)
    this.cache.set(folderId, items)
    return items
  }

  /** Cache fuer einen Ordner invalidieren (nach Schreib-/Loeschvorgang). */
  invalidate(folderId: string): void {
    this.cache.delete(folderId)
  }
}
