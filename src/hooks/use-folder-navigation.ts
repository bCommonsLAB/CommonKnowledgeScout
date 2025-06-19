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
import { StateLogger } from '@/lib/debug/logger';

export function useFolderNavigation() {
  const { provider } = useStorage();
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const setCurrentFolderId = useSetAtom(currentFolderIdAtom);

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
      setCurrentFolderId(folderId);
      return;
    }

    StateLogger.info('FolderNavigation', 'Cache miss, loading path from provider', { folderId, missingIds });
    // Sonst wie bisher: API-Call und Cache auffüllen
    const pathItems = await provider.getPathItemsById(folderId);
    setLibraryState(state => {
      const newCache = { ...state.folderCache };
      pathItems.forEach(folder => {
        newCache[folder.id] = folder;
      });
      return { ...state, folderCache: newCache };
    });
    setCurrentFolderId(folderId);
  }, [provider, setLibraryState, setCurrentFolderId, libraryState.folderCache]);

  return navigateToFolder;
} 