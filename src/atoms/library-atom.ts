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

// Hilfsfunktion für aktive Library
export const activeLibraryAtom = atom(
  get => {
    const state = get(libraryAtom)
    return state.libraries.find(lib => lib.id === state.activeLibraryId)
  }
)

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

// Atom für Breadcrumb-Pfad-Informationen
export const breadcrumbItemsAtom = atom<StorageItem[]>([])

// Schreibgeschütztes Atom für Breadcrumb-Items
export const readBreadcrumbItemsAtom = atom(
  get => get(breadcrumbItemsAtom)
)

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
      console.log('[breadcrumbItemsAtom] Aktualisiere Breadcrumb-Items (Längenänderung):', {
        vorher: currentItems.length,
        nachher: newItems.length,
        items: newItems.map(item => item.metadata.name).join('/')
      });
      set(breadcrumbItemsAtom, newItems);
      return;
    }
    
    // Vergleiche die IDs, um zu sehen, ob sich die Items geändert haben
    const isDifferent = newItems.some((item, index) => 
      item.id !== currentItems[index].id
    );
    
    if (isDifferent) {
      console.log('[breadcrumbItemsAtom] Aktualisiere Breadcrumb-Items (Inhaltsänderung):', {
        items: newItems.map(item => item.metadata.name).join('/')
      });
      set(breadcrumbItemsAtom, newItems);
    } else {
      console.log('[breadcrumbItemsAtom] Ignoriere identische Breadcrumb-Items');
    }
  }
) 