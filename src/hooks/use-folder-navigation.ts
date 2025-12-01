"use client";
/**
 * useFolderNavigation Hook
 *
 * Bietet eine zentrale navigateToFolder Funktion, die beim Ordnerwechsel
 * den gesamten Pfad in den folderCache schreibt und currentFolderId setzt.
 *
 * @returns navigateToFolder(folderId: string): Promise<void>
 */
import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { libraryAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StateLogger } from '@/lib/debug/logger';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { StorageItem } from '@/lib/storage/types';

export function useFolderNavigation() {
  const { provider, listItems } = useStorage();
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Navigiert zu einem Ordner, cached den Pfad und setzt currentFolderId
   * @param folderId Ziel-Ordner-ID
   */
  const navigateToFolder = useCallback(async (folderId: string) => {
    if (!provider) return;

    // Prüfe, ob der gesamte Pfad schon im Cache ist
    const folderCache = libraryState.folderCache || {};
    let currentId = folderId;
    let allInCache = true;
    const missingIds: string[] = [];
    while (currentId && currentId !== 'root') {
      if (!folderCache[currentId]) {
        allInCache = false;
        missingIds.push(currentId);
        break;
      }
      currentId = folderCache[currentId].parentId;
    }

    if (allInCache && folderCache[folderId]) {
      StateLogger.info('FolderNavigation', 'Cache hit for folder path', { folderId });
      // Beide Updates atomar in einem setLibraryState-Call kombinieren
      // (auch bei Cache-Hit, um Konsistenz zu gewährleisten)
      setLibraryState(state => ({
        ...state,
        currentFolderId: folderId
      }));
      // URL-Sync: folderId Query-Param setzen (andere Params beibehalten)
      try {
        const params = new URLSearchParams(searchParams ?? undefined);
        // Wenn die activeLibraryId im Query nicht zur aktuellen Library passt, entferne folderId
        params.set('folderId', folderId);
        const url = `${pathname}?${params.toString()}`;
        router.replace(url);
      } catch {}
      return;
    }
    
    // PERFORMANCE-OPTIMIERUNG: Baue Pfad manuell auf, um Root-Items aus Cache zu verwenden
    // getPathItemsById verwendet intern listItemsById('root'), das nicht dedupliziert ist
    // Daher bauen wir den Pfad manuell auf, um listItems (dedupliziert) zu verwenden
    const path = await provider.getPathById(folderId); // z.B. /foo/bar/baz
    const segments = path.split('/').filter(Boolean);
    const pathItems: StorageItem[] = [];
    
    // Baue Pfad auf, beginnend mit Root
    let parentId = 'root';
    for (const segment of segments) {
      // PERFORMANCE-OPTIMIERUNG: Prüfe zuerst Cache, dann listItems (dedupliziert)
      const cachedParent = folderCache[parentId];
      let children: StorageItem[];
      
      if (cachedParent?.children && cachedParent.children.length > 0) {
        // Verwende Cache-Inhalt
        children = cachedParent.children;
      } else {
        // Cache miss, lade mit listItems (dedupliziert)
        children = await listItems(parentId);
      }
      
      const folder = children.find(child => child.metadata.name === segment && child.type === 'folder');
      if (!folder) break;
      pathItems.push(folder);
      parentId = folder.id;
    }
    
    // Füge Zielordner hinzu, wenn er ein Ordner ist und noch nicht im Pfad enthalten ist
    if (folderId !== 'root' && pathItems.length > 0) {
      const lastPathItem = pathItems[pathItems.length - 1];
      if (lastPathItem.id !== folderId) {
        try {
          const targetItem = await provider.getItemById(folderId);
          if (targetItem.type === 'folder') {
            pathItems.push(targetItem);
          }
        } catch {
          // Ignore - Zielordner konnte nicht geladen werden
        }
      }
    }
    
    // Füge Root-Item am Anfang hinzu
    const rootItem: StorageItem = {
      id: 'root',
      parentId: '',
      type: 'folder',
      metadata: {
        name: 'root',
        size: 0,
        modifiedAt: new Date(),
        mimeType: 'application/folder'
      }
    };
    const finalPathItems = [rootItem, ...pathItems];
    
    // Beide Updates atomar in einem setLibraryState-Call kombinieren
    // (setCurrentFolderId aktualisiert auch libraryAtom, daher kombinieren wir beide)
    // currentFolderIdAtom ist ein derived atom, das libraryAtom.currentFolderId liest,
    // daher wird es automatisch aktualisiert, wenn libraryAtom aktualisiert wird
    setLibraryState(state => {
      const newCache = { ...state.folderCache };
      // Alle Pfad-Items in den Cache schreiben (inkl. Root, falls vorhanden)
      finalPathItems.forEach(folder => {
        // Root-Ordner wird nicht in den Cache geschrieben (wird in currentPathAtom dynamisch erzeugt)
        if (folder.id !== 'root') {
          newCache[folder.id] = folder;
        }
      });
      
      return { 
        ...state, 
        folderCache: newCache,
        currentFolderId: folderId  // currentFolderId auch hier setzen (atomar)
      };
    });
    // URL-Sync: folderId Query-Param setzen (andere Params beibehalten)
    try {
      const params = new URLSearchParams(searchParams ?? undefined);
      params.set('folderId', folderId);
      const url = `${pathname}?${params.toString()}`;
      router.replace(url);
    } catch {}
  }, [provider, listItems, setLibraryState, libraryState.folderCache, router, pathname, searchParams]);

  return navigateToFolder;
} 