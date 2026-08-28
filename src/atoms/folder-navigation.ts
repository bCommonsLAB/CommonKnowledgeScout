/**
 * @fileoverview Ordner-Navigation im Archiv — aktueller Ordner, Pfad-Cache, Baumzustand.
 *
 * @description
 * Zustand der Datei-/Ordner-Navigation. Bis zu dieser Welle lag er im selben
 * Atom wie die Library-Auswahl (`@/atoms/library-selection`); getrennt wurde er,
 * weil die Auswahl in die Schale gehoert (`@ks/shell`), dieser Zustand aber ins
 * Archiv-Modul (Modul-Landkarte §1, Schicht 3). Ein gemeinsames Zustandsobjekt
 * haette beide Seiten aneinandergebunden.
 *
 * @module library
 */

import { atom } from "jotai"
import { StorageItem } from "@/lib/storage/types"
import { activeLibraryAtom } from "@/atoms/library-selection"

/** Wo man gerade steht — plus der Ordner-Cache, aus dem der Pfad gebaut wird. */
export interface FolderNavigationState {
  currentFolderId: string;
  folderCache: Record<string, StorageItem>;
}

const initialState: FolderNavigationState = {
  currentFolderId: "root",
  folderCache: {}
}

export const folderNavigationAtom = atom<FolderNavigationState>(initialState)
folderNavigationAtom.debugLabel = "folderNavigationAtom"

// Aktuelles Verzeichnis
export const currentFolderIdAtom = atom(
  get => get(folderNavigationAtom).currentFolderId,
  (get, set, newFolderId: string) => {
    set(folderNavigationAtom, {
      ...get(folderNavigationAtom),
      currentFolderId: newFolderId
    })
  }
)
currentFolderIdAtom.debugLabel = "currentFolderIdAtom"

// Automatische Pfad-Berechnung
export const currentPathAtom = atom(
  get => {
    const currentLibrary = get(activeLibraryAtom);
    const currentFolderId = get(currentFolderIdAtom);
    const navState = get(folderNavigationAtom);

    if (!currentLibrary || !currentFolderId) {
      return [];
    }

    // Root-Item immer als erstes
    const rootItem: StorageItem = {
      id: 'root',
      parentId: '',
      type: 'folder',
      metadata: {
        name: currentLibrary.label || '/',
        size: 0,
        modifiedAt: new Date(),
        mimeType: 'application/folder'
      }
    };

    // Bei root nur das Root-Item zurückgeben
    if (currentFolderId === 'root') {
      return [rootItem];
    }

    // Pfad aus dem Ordner-Cache berechnen
    const folderCache = navState.folderCache;
    if (!folderCache) {
      return [rootItem];
    }

    // Pfad aufbauen
    const path: StorageItem[] = [];
    let currentId = currentFolderId;
    const missingIds: string[] = [];

    while (currentId && currentId !== 'root') {
      const folder = folderCache[currentId];
      if (!folder) {
        // Debug: Fehlende Ordner im Cache protokollieren
        missingIds.push(currentId);
        console.warn('[currentPathAtom] Ordner nicht im Cache gefunden', {
          currentId,
          currentFolderId,
          cacheKeys: Object.keys(folderCache),
          missingIds
        });
        break;
      }
      path.unshift(folder);
      currentId = folder.parentId;
    }

    return [rootItem, ...path];
  }
)
currentPathAtom.debugLabel = "currentPathAtom"

// FileTree Ready Status
export const fileTreeReadyAtom = atom<boolean>(false)
fileTreeReadyAtom.debugLabel = "fileTreeReadyAtom"

// Geladene Kinder im FileTree
export const loadedChildrenAtom = atom<Record<string, StorageItem[]>>({})
loadedChildrenAtom.debugLabel = "loadedChildrenAtom"

// Expandierte Ordner im FileTree
export const expandedFoldersAtom = atom<Set<string>>(new Set(['root']))
expandedFoldersAtom.debugLabel = "expandedFoldersAtom"

// Letzter geladener Ordner
export const lastLoadedFolderAtom = atom<string | null>(null)
lastLoadedFolderAtom.debugLabel = "lastLoadedFolderAtom"

// Typen für den Loading-State
export interface LoadingState {
  isLoading: boolean;
  loadingFolderId: string | null;
}

// Lade-Status
export const loadingStateAtom = atom<LoadingState>({
  isLoading: false,
  loadingFolderId: null
})
loadingStateAtom.debugLabel = "loadingStateAtom"
