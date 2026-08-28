/**
 * @fileoverview Breadcrumb-Pfad aus dem Ordner-Cache — als reine Funktion.
 *
 * Wie `filter-sort.ts` aus einem abgeleiteten Atom herausgeloest: Die Berechnung
 * braucht den Namen der aktiven Bibliothek, und die Auswahl wandert nach
 * `@ks/shell`, wo sie nur ueber Hooks erreichbar ist.
 */

import { StorageItem } from '@/lib/storage/types'

/**
 * Baut den Pfad vom Wurzel-Item bis zum aktuellen Ordner.
 *
 * Gibt eine leere Liste zurueck, solange keine Bibliothek gewaehlt ist. Fehlt
 * ein Ordner im Cache, endet der Pfad dort — mit einer Warnung, damit die
 * Luecke sichtbar bleibt (kein stiller Fallback).
 */
export function buildCurrentPath(
  activeLibrary: { label?: string } | undefined,
  currentFolderId: string,
  folderCache: Record<string, StorageItem>,
): StorageItem[] {
  if (!activeLibrary || !currentFolderId) {
    return []
  }

  // Root-Item immer als erstes
  const rootItem: StorageItem = {
    id: 'root',
    parentId: '',
    type: 'folder',
    metadata: {
      name: activeLibrary.label || '/',
      size: 0,
      modifiedAt: new Date(),
      mimeType: 'application/folder'
    }
  }

  // Bei root nur das Root-Item zurückgeben
  if (currentFolderId === 'root') {
    return [rootItem]
  }

  if (!folderCache) {
    return [rootItem]
  }

  // Pfad aufbauen
  const path: StorageItem[] = []
  let currentId = currentFolderId
  const missingIds: string[] = []

  while (currentId && currentId !== 'root') {
    const folder = folderCache[currentId]
    if (!folder) {
      // Debug: Fehlende Ordner im Cache protokollieren
      missingIds.push(currentId)
      console.warn('[buildCurrentPath] Ordner nicht im Cache gefunden', {
        currentId,
        currentFolderId,
        cacheKeys: Object.keys(folderCache),
        missingIds
      })
      break
    }
    path.unshift(folder)
    currentId = folder.parentId
  }

  return [rootItem, ...path]
}
