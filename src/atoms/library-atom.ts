import { atom } from "jotai"
import { ClientLibrary } from "@/types/library"
import { StorageItem } from "@/lib/storage/types"

export interface LibraryContextData {
  libraries: ClientLibrary[];
  activeLibraryId: string;
  currentFolderId: string;
}

// Initialer State
const initialState: LibraryContextData = {
  libraries: [],
  activeLibraryId: "",
  currentFolderId: "root"
}

// Hauptatom für Library-Kontext
export const libraryAtom = atom<LibraryContextData>(initialState)
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

// Erweitere mit Setter für Bibliotheken
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

// Hilfsfunktion für aktive Library
export const activeLibraryAtom = atom(
  get => {
    const state = get(libraryAtom)
    return state.libraries.find(lib => lib.id === state.activeLibraryId)
  }
)
activeLibraryAtom.debugLabel = "activeLibraryAtom"

// Atom für aktuelles Verzeichnis
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

// Atom für Breadcrumb-Pfad-Informationen
export const breadcrumbItemsAtom = atom<StorageItem[]>([])
breadcrumbItemsAtom.debugLabel = "breadcrumbItemsAtom"

// Atom für die ausgewählte Datei
export const selectedFileAtom = atom<StorageItem | null>(null)
selectedFileAtom.debugLabel = "selectedFileAtom"

// Kombiniertes Atom für Breadcrumb der ausgewählten Datei
export const selectedFileBreadcrumbAtom = atom<{
  items: StorageItem[];
  currentId: string;
}>({
  items: [],
  currentId: 'root'
})
selectedFileBreadcrumbAtom.debugLabel = "selectedFileBreadcrumbAtom"

// Metadaten der ausgewählten Datei
export const selectedFileMetadataAtom = atom<{
  name: string;
  size: number;
  type: string;
  modified: Date;
  created: Date;
  transcriptionEnabled?: boolean;
} | null>(null)
selectedFileMetadataAtom.debugLabel = "selectedFileMetadataAtom"

// Schreibgeschütztes Atom für Breadcrumb-Items
export const readBreadcrumbItemsAtom = atom(
  get => get(breadcrumbItemsAtom)
)
readBreadcrumbItemsAtom.debugLabel = "readBreadcrumbItemsAtom"

// Nur-Schreiben Atom für Breadcrumb-Items mit Validierung
export const writeBreadcrumbItemsAtom = atom(
  null, // Keine Leseoperation
  (get, set, newItems: StorageItem[]) => {
    const currentItems = get(breadcrumbItemsAtom);
    
    // Beide Arrays leer? Nichts zu tun
    if (newItems.length === 0 && currentItems.length === 0) {
      return;
    }
    
    // Unterschiedliche Längen? Definitiv Update nötig
    if (newItems.length !== currentItems.length) {
      set(breadcrumbItemsAtom, newItems);
      return;
    }
    
    // Vergleiche die IDs, um zu sehen, ob sich die Items geändert haben
    const isDifferent = newItems.some((item, index) => 
      item.id !== currentItems[index].id
    );
    
    if (isDifferent) {
      set(breadcrumbItemsAtom, newItems);
    }
  }
)
writeBreadcrumbItemsAtom.debugLabel = "writeBreadcrumbItemsAtom"

export const fileTreeReadyAtom = atom(false); 