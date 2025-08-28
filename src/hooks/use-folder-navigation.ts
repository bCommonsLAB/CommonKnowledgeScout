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
import { useAtom, useSetAtom } from 'jotai';
import { libraryAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { NavigationLogger, StateLogger } from '@/lib/debug/logger';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useFolderNavigation() {
  const { provider } = useStorage();
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const setCurrentFolderId = useSetAtom(currentFolderIdAtom);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Navigiert zu einem Ordner, cached den Pfad und setzt currentFolderId
   * @param folderId Ziel-Ordner-ID
   */
  const navigateToFolder = useCallback(async (folderId: string) => {
    if (!provider) return;

    NavigationLogger.info('debug@nav', 'navigateToFolder called', { folderId });

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
      setCurrentFolderId(folderId);
      // URL-Sync: folderId Query-Param setzen (andere Params beibehalten)
      try {
        const params = new URLSearchParams(searchParams ?? undefined);
        // Wenn die activeLibraryId im Query nicht zur aktuellen Library passt, entferne folderId
        params.set('folderId', folderId);
        const url = `${pathname}?${params.toString()}`;
        NavigationLogger.debug('debug@nav', 'URL updated (cache hit)', { url, folderId });
        router.replace(url);
      } catch {}
      return;
    }

    StateLogger.info('FolderNavigation', 'Cache miss, loading path from provider', { folderId, missingIds });
    // Sonst wie bisher: API-Call und Cache auffüllen
    const pathItems = await provider.getPathItemsById(folderId);
    NavigationLogger.info('debug@nav', 'Loaded path items for folder', { folderId, pathLength: pathItems.length });
    setLibraryState(state => {
      const newCache = { ...state.folderCache };
      pathItems.forEach(folder => {
        newCache[folder.id] = folder;
      });
      return { ...state, folderCache: newCache };
    });
    setCurrentFolderId(folderId);
    // URL-Sync: folderId Query-Param setzen (andere Params beibehalten)
    try {
      const params = new URLSearchParams(searchParams ?? undefined);
      params.set('folderId', folderId);
      const url = `${pathname}?${params.toString()}`;
      NavigationLogger.debug('debug@nav', 'URL updated (cache miss)', { url, folderId });
      router.replace(url);
    } catch {}
  }, [provider, setLibraryState, setCurrentFolderId, libraryState.folderCache, router, pathname, searchParams]);

  return navigateToFolder;
} 