/**
 * @fileoverview Ordner-Navigation im Archiv — aktueller Ordner, Pfad-Cache, Baumzustand.
 *
 * @description
 * Zustand der Datei-/Ordner-Navigation. Bis zu dieser Welle lag er im selben
 * Atom wie die Library-Auswahl (heute `@ks/shell/react`); getrennt wurde er,
 * weil die Auswahl in die Schale gehoert (`@ks/shell`), dieser Zustand aber ins
 * Archiv-Modul (Modul-Landkarte §1, Schicht 3). Ein gemeinsames Zustandsobjekt
 * haette beide Seiten aneinandergebunden.
 *
 * Die Pfad-Berechnung (frueher `currentPathAtom`) steht seit dieser Welle als
 * reine Funktion in `@/lib/file-list/current-path` mit `useCurrentPath()`
 * davor — sie braucht den Namen der aktiven Bibliothek, und die ist nach dem
 * Umzug in die Schale nur ueber Hooks erreichbar.
 *
 * @module library
 */

import { atom } from "jotai"
import { StorageItem } from "@/lib/storage/types"

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
