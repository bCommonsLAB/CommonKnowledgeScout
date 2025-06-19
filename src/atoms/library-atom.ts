import { atom } from "jotai"
import { atomFamily } from "jotai/utils"
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

// Library-spezifische Sort/Filter-Konfiguration
export interface SortFilterConfig {
  searchTerm: string
  sortField: 'name' | 'size' | 'date' | 'type'
  sortOrder: 'asc' | 'desc'
}

// AtomFamily für library-spezifische Sort/Filter-Konfiguration
export const librarySortFilterConfigAtom = atomFamily(
  (libraryId: string) => atom<SortFilterConfig>({
    searchTerm: '',
    sortField: 'name',
    sortOrder: 'asc'
  })
)

// Getter-Atome für die aktuelle Library
export const searchTermAtom = atom(
  (get) => {
    const libraryId = get(activeLibraryIdAtom)
    if (!libraryId) return ''
    return get(librarySortFilterConfigAtom(libraryId)).searchTerm
  },
  (get, set, newSearchTerm: string) => {
    const libraryId = get(activeLibraryIdAtom)
    if (!libraryId) return
    const config = get(librarySortFilterConfigAtom(libraryId))
    set(librarySortFilterConfigAtom(libraryId), { ...config, searchTerm: newSearchTerm })
  }
)

export const sortFieldAtom = atom(
  (get) => {
    const libraryId = get(activeLibraryIdAtom)
    if (!libraryId) return 'name' as const
    return get(librarySortFilterConfigAtom(libraryId)).sortField
  },
  (get, set, newSortField: 'name' | 'size' | 'date' | 'type') => {
    const libraryId = get(activeLibraryIdAtom)
    if (!libraryId) return
    const config = get(librarySortFilterConfigAtom(libraryId))
    set(librarySortFilterConfigAtom(libraryId), { ...config, sortField: newSortField })
  }
)

export const sortOrderAtom = atom(
  (get) => {
    const libraryId = get(activeLibraryIdAtom)
    if (!libraryId) return 'asc' as const
    return get(librarySortFilterConfigAtom(libraryId)).sortOrder
  },
  (get, set, newSortOrder: 'asc' | 'desc') => {
    const libraryId = get(activeLibraryIdAtom)
    if (!libraryId) return
    const config = get(librarySortFilterConfigAtom(libraryId))
    set(librarySortFilterConfigAtom(libraryId), { ...config, sortOrder: newSortOrder })
  }
)

// Nur Dateien, keine Verzeichnisse
export const filesOnlyAtom = atom((get) => {
  const items = get(folderItemsAtom) ?? []
  return items.filter(item => item.type === 'file')
})

// Sortiert & gefiltert (nur Dateien)
export const sortedFilteredFilesAtom = atom((get) => {
  const files = get(filesOnlyAtom)
  const searchTerm = get(searchTermAtom).toLowerCase()
  const sortField = get(sortFieldAtom)
  const sortOrder = get(sortOrderAtom)

  let filtered = files.filter(item =>
    !item.metadata.name.startsWith('.') &&
    !item.metadata.isTwin &&
    (searchTerm === '' || item.metadata.name.toLowerCase().includes(searchTerm))
  )

  filtered = filtered.sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'type':
        cmp = (a.metadata.mimeType || '').localeCompare(b.metadata.mimeType || '')
        break
      case 'name':
        cmp = a.metadata.name.localeCompare(b.metadata.name)
        break
      case 'size':
        cmp = (a.metadata.size || 0) - (b.metadata.size || 0)
        break
      case 'date':
        cmp = new Date(a.metadata.modifiedAt ?? 0).getTime() - new Date(b.metadata.modifiedAt ?? 0).getTime()
        break
    }
    return sortOrder === 'asc' ? cmp : -cmp
  })

  return filtered
}) 