/**
 * @fileoverview useRootItems Hook - Zentrale Logik für Root-Item-Zugriff
 * 
 * @description
 * Hook für zentralen Zugriff auf Root-Items mit Fallback-Logik.
 * Verwendet folderItemsAtom wenn currentFolderId === 'root', sonst API-Call.
 * 
 * @module hooks/use-root-items
 */

import { useAtomValue } from 'jotai';
import { useCallback } from 'react';
import { folderItemsAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { StorageItem } from '@/lib/storage/types';
import { useStorage } from '@/contexts/storage-context';

/**
 * Hook für zentralen Zugriff auf Root-Items
 * 
 * Verwendet folderItemsAtom wenn:
 * - currentFolderId === 'root'
 * - folderItemsAtom bereits Root-Items enthält
 * 
 * Fallback:
 * - Wenn folderItemsAtom leer ist oder currentFolderId !== 'root',
 *   wird ein API-Call gemacht
 * 
 * @param provider Optional: StorageProvider für Fallback-API-Call
 * @returns Funktion die Root-Items zurückgibt (Promise)
 * 
 * @example
 * ```typescript
 * const getRootItems = useRootItems();
 * const items = await getRootItems();
 * ```
 */
export function useRootItems() {
  const folderItems = useAtomValue(folderItemsAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const { listItems } = useStorage();

  const getRootItems = useCallback(async (): Promise<StorageItem[]> => {
    // Wenn aktueller Ordner root ist und Items bereits geladen sind, verwende diese
    if (currentFolderId === 'root' && folderItems && folderItems.length > 0) {
      return folderItems;
    }

    // Fallback: API-Call
    // Verwende listItems aus StorageContext (hat bereits Request-Deduplizierung)
    try {
      const items = await listItems('root');
      return items;
    } catch (error) {
      console.error('[useRootItems] Fehler beim Laden der Root-Items:', error);
      throw error;
    }
  }, [currentFolderId, folderItems, listItems]);

  return getRootItems;
}

/**
 * Hook für direkten Zugriff auf Root-Items (synchron wenn verfügbar)
 * 
 * Gibt Root-Items direkt zurück wenn:
 * - currentFolderId === 'root'
 * - folderItemsAtom bereits Root-Items enthält
 * 
 * Sonst: undefined (muss dann getRootItems verwendet werden)
 * 
 * @returns Root-Items oder undefined
 * 
 * @example
 * ```typescript
 * const rootItems = useRootItemsSync();
 * if (rootItems) {
 *   // Items sind bereits geladen
 * } else {
 *   // Items müssen geladen werden
 *   const items = await getRootItems();
 * }
 * ```
 */
export function useRootItemsSync(): StorageItem[] | undefined {
  const folderItems = useAtomValue(folderItemsAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);

  // Nur zurückgeben wenn aktueller Ordner root ist und Items vorhanden sind
  if (currentFolderId === 'root' && folderItems && folderItems.length > 0) {
    return folderItems;
  }

  return undefined;
}

