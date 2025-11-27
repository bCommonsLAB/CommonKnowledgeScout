/**
 * @fileoverview Request Deduplicator - Verhindert doppelte API-Calls
 * 
 * @description
 * Zentrale Request-Deduplizierung für Storage-API-Calls
 * Verhindert, dass mehrere Komponenten gleichzeitig die gleichen Items laden
 * durch Promise-Sharing für identische Requests
 * 
 * @module storage/request-deduplicator
 */

import { StorageItem } from '@/lib/storage/types';

/**
 * Map für laufende Requests
 * Key-Format: "{libraryId}:{folderId}"
 * Value: Promise<StorageItem[]>
 */
const pendingRequests = new Map<string, Promise<StorageItem[]>>();

/**
 * Dedupliziert Requests für identische Library/Folder-Kombinationen
 * 
 * Wenn bereits ein Request für den gleichen Key läuft, wird das bestehende Promise zurückgegeben.
 * Andernfalls wird der Request ausgeführt und das Promise gespeichert.
 * Nach Completion wird der Request aus der Map entfernt.
 * 
 * @param key Eindeutiger Key für den Request (Format: "{libraryId}:{folderId}")
 * @param request Funktion die den eigentlichen Request ausführt
 * @returns Promise mit den geladenen Items
 * 
 * @example
 * ```typescript
 * const items = await deduplicateRequest(
 *   `${libraryId}:root`,
 *   () => provider.listItemsById('root')
 * );
 * ```
 */
export function deduplicateRequest(
  key: string,
  request: () => Promise<StorageItem[]>
): Promise<StorageItem[]> {
  // Prüfe ob bereits ein Request für diesen Key läuft
  const existingRequest = pendingRequests.get(key);
  if (existingRequest) {
    return existingRequest;
  }

  // Erstelle neuen Request
  const promise = request()
    .then((items) => {
      // Request erfolgreich - entferne aus Map
      pendingRequests.delete(key);
      return items;
    })
    .catch((error) => {
      // Request fehlgeschlagen - entferne aus Map
      pendingRequests.delete(key);
      throw error;
    });

  // Speichere Promise in Map
  pendingRequests.set(key, promise);

  return promise;
}

/**
 * Erstellt einen deduplizierten Key für einen Storage-Request
 * 
 * @param libraryId Die Library-ID
 * @param folderId Die Folder-ID (z.B. 'root')
 * @returns Key-String im Format "{libraryId}:{folderId}"
 */
export function createRequestKey(libraryId: string, folderId: string): string {
  return `${libraryId}:${folderId}`;
}

/**
 * Entfernt alle laufenden Requests (für Testing/Cleanup)
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}

/**
 * Gibt die Anzahl der laufenden Requests zurück (für Debugging)
 */
export function getPendingRequestCount(): number {
  return pendingRequests.size;
}

