import { atom } from "jotai"
import { ClientLibrary } from "@/types/library"
import { StorageItem } from "@/lib/storage/types"

// Basis-Typen für den Library-State
export interface LibraryState {
  libraries: ClientLibrary[];
  activeLibraryId: string;
  currentFolderId: string;
  folderCache: Record<string, StorageItem>;
}

// Typen für den Loading-State
export interface LoadingState {
  isLoading: boolean;
  loadingFolderId: string | null;
}

// Initialer State
const initialState: LibraryState = {
  libraries: [],
  activeLibraryId: "",
  currentFolderId: "root",
  folderCache: {}
}

// Hauptatom für Library-State
export const libraryAtom = atom<LibraryState>(initialState)
libraryAtom.debugLabel = "libraryAtom"

// Derivierte Atome für spezifische Eigenschaften
export const activeLibraryIdAtom = atom(
  get => get(libraryAtom).activeLibraryId,
  (get, set, newId: string) => {
    set(libraryAtom, {
      ...get(libraryAtom),
      activeLibraryId: newId
    })
  }
)
activeLibraryIdAtom.debugLabel = "activeLibraryIdAtom"

// Bibliotheken-Atom
export const librariesAtom = atom(
  get => get(libraryAtom).libraries,
  (get, set, newLibraries: ClientLibrary[]) => {
    set(libraryAtom, {
      ...get(libraryAtom),
      libraries: newLibraries
    })
  }
)
librariesAtom.debugLabel = "librariesAtom"

// Aktive Bibliothek
export const activeLibraryAtom = atom(
  get => {
    const state = get(libraryAtom)
    return state.libraries.find(lib => lib.id === state.activeLibraryId)
  }
)
activeLibraryAtom.debugLabel = "activeLibraryAtom"

// Aktuelles Verzeichnis
export const currentFolderIdAtom = atom(
  get => get(libraryAtom).currentFolderId,
  (get, set, newFolderId: string) => {
    set(libraryAtom, {
      ...get(libraryAtom),
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
    const libraryState = get(libraryAtom);
    
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
    const folderCache = libraryState.folderCache;
    if (!folderCache) {
      return [rootItem];
    }

    // Pfad aufbauen
    const path: StorageItem[] = [];
    let currentId = currentFolderId;
    
    while (currentId && currentId !== 'root') {
      const folder = folderCache[currentId];
      if (!folder) break;
      path.unshift(folder);
      currentId = folder.parentId;
    }

    return [rootItem, ...path];
  }
)
currentPathAtom.debugLabel = "currentPathAtom"

// Ausgewählte Datei
export const selectedFileAtom = atom<StorageItem | null>(null)
selectedFileAtom.debugLabel = "selectedFileAtom"

// FileTree Ready Status
export const fileTreeReadyAtom = atom<boolean>(false)
fileTreeReadyAtom.debugLabel = "fileTreeReadyAtom"

// Ordner-Items
export const folderItemsAtom = atom<StorageItem[]>([])
folderItemsAtom.debugLabel = "folderItemsAtom"

// Geladene Kinder im FileTree
export const loadedChildrenAtom = atom<Record<string, StorageItem[]>>({})
loadedChildrenAtom.debugLabel = "loadedChildrenAtom"

// Lade-Status
export const loadingStateAtom = atom<LoadingState>({
  isLoading: false,
  loadingFolderId: null
})
loadingStateAtom.debugLabel = "loadingStateAtom"

// Expandierte Ordner im FileTree
export const expandedFoldersAtom = atom<Set<string>>(new Set(['root']))
expandedFoldersAtom.debugLabel = "expandedFoldersAtom"

// Letzter geladener Ordner
export const lastLoadedFolderAtom = atom<string | null>(null)
lastLoadedFolderAtom.debugLabel = "lastLoadedFolderAtom" 