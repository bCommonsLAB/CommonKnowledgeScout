/**
 * @fileoverview Datei-Listen- und Annotations-Zustand der Bibliothek.
 *
 * @description
 * Was die Dateiliste zeigt: geladene Items, Auswahl, Suche/Sortierung je
 * Library, Annotationen (DIVA und generisch) und der Review-Modus.
 *
 * Zwei Nachbarn sind seit dieser Welle eigene Module — die Datei re-exportiert
 * sie, damit bestehende Importpfade gueltig bleiben (Migrationsstrategie G2):
 * - `@/atoms/library-selection` — welche Bibliotheken es gibt, welche aktiv ist
 *   (Schalen-Zustand, wandert nach `@ks/shell`)
 * - `@/atoms/folder-navigation` — aktueller Ordner, Pfad-Cache, Baumzustand
 *
 * @module library
 *
 * @usedIn
 * - src/contexts/storage-context.tsx: Uses library atoms for state management
 * - src/components/library: Library components use atoms
 * - src/hooks/use-storage-provider.tsx: Uses library atoms
 *
 * @dependencies
 * - jotai: State management library
 * - @/lib/storage/types: StorageItem type
 * - @/atoms/transcription-options: File category filter
 */

import { atom } from "jotai"
import { atomFamily } from "jotai/utils"
import { StorageItem } from "@/lib/storage/types"
import { activeLibraryAtom, activeLibraryIdAtom } from "@/atoms/library-selection"
import { fileCategoryFilterAtom, getFileCategory } from '@/atoms/transcription-options'
import { isBasecolorFileName } from '@/lib/diva-texture/preprocess-folder'

// Fassade auf die ausgelagerten Nachbarn (G2) — bestehende Importe bleiben gueltig.
export type { LibraryState } from "@/atoms/library-selection"
export {
  libraryAtom,
  activeLibraryIdAtom,
  noLibrarySelectedAtom,
  librariesAtom,
  activeLibraryAtom,
  libraryStatusAtom,
} from "@/atoms/library-selection"
export type { FolderNavigationState, LoadingState } from "@/atoms/folder-navigation"
export {
  folderNavigationAtom,
  currentFolderIdAtom,
  currentPathAtom,
  fileTreeReadyAtom,
  loadedChildrenAtom,
  expandedFoldersAtom,
  lastLoadedFolderAtom,
  loadingStateAtom,
} from "@/atoms/folder-navigation"

// Ausgewählte Datei
export const selectedFileAtom = atom<StorageItem | null>(null)
selectedFileAtom.debugLabel = "selectedFileAtom"

// Ordner-Items
export const folderItemsAtom = atom<StorageItem[]>([])
folderItemsAtom.debugLabel = "folderItemsAtom"

// Library-spezifische Sort/Filter-Konfiguration
export interface SortFilterConfig {
  searchTerm: string
  sortField: 'name' | 'size' | 'date' | 'type'
  sortOrder: 'asc' | 'desc'
}

// AtomFamily für library-spezifische Sort/Filter-Konfiguration
export const librarySortFilterConfigAtom = atomFamily(
  () => atom<SortFilterConfig>({
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

// ── Generische Item-Annotationen (annotieren -> filtern -> gruppieren) ──────
// Quelle: GET /api/library/[id]/item-annotations (MongoDB, storage-unabhaengig).
// Keyed nach Dateiname (stabil innerhalb eines Ordners). DIVA ist der erste
// Annotator; die Mechanik bleibt attribut-agnostisch.

export type AnnotationFilterMode = 'all' | 'with' | 'without'
export type AnnotationsStatus = 'idle' | 'loading' | 'loaded' | 'error'

// Attribut-Bag je Datei (z.B. { divaTexture: true, stoffgruppe: 'Feincord', ... }).
export const itemAnnotationsAtom = atom<Map<string, Record<string, unknown>>>(new Map())
itemAnnotationsAtom.debugLabel = "itemAnnotationsAtom"

// Ladezustand der Annotationen (fuer UI: Spinner / Fehlerhinweis, kein stiller Fallback).
export const itemAnnotationsStatusAtom = atom<AnnotationsStatus>('idle')
itemAnnotationsStatusAtom.debugLabel = "itemAnnotationsStatusAtom"

// 3-Wege-Filter (bei DIVA aktiv): alle *_basecolor / mit Sidecar-Treffer / ohne.
export const annotationFilterModeAtom = atom<AnnotationFilterMode>('all')
annotationFilterModeAtom.debugLabel = "annotationFilterModeAtom"

// Rohes Sidecar-Entry je Datei im aktuellen DIVA-Ordner (1:1 OptionvalueEntry).
// Parallel zu `itemAnnotationsAtom` — die Filter/Group-Logik nutzt weiterhin
// die flachen Attribute, waehrend die Dateiliste fuer Zusatzspalten + das
// Preview-Thumbnail die rohen Sidecar-Felder konsumiert.
// Bewusst `Record<string, unknown>` statt importiertem Typ — Library-Atom soll
// nicht von Diva-spezifischen Typen abhaengen (kein Layering-Verstoss).
export const itemSidecarEntriesAtom = atom<Map<string, Record<string, unknown>>>(new Map())
itemSidecarEntriesAtom.debugLabel = "itemSidecarEntriesAtom"

// Vom Klassifizierer in der DIVA-Toolbar gewaehlte Zusatzspalten fuer die
// Dateiliste. Reihenfolge ist die Anzeige-Reihenfolge. Spezialschluessel
// `_thumbnail` rendert das Preview-Bitmap aus `entry.Image`.
export const divaExtraColumnsAtom = atom<string[]>([])
divaExtraColumnsAtom.debugLabel = "divaExtraColumnsAtom"

// Sidecar-Status fuer das aktuelle DIVA-Verzeichnis (optionvalues.json im
// Grosseltern-Ordner). Wird vom DivaToolsMenu in der Dateilisten-Toolbar
// visualisiert: orange wenn der Sidecar gefunden wurde, neutral wenn nicht.
// Kein silent fallback — 'error' wird separat ausgewiesen.
export interface DivaSidecarStatus {
  state: 'idle' | 'loading' | 'loaded' | 'error'
  found: boolean
  entryCount?: number
  sourceFileName?: string
  /** ISO-Zeitstempel des Sidecar-Aenderungsdatums. */
  modifiedAt?: string
}
export const divaSidecarStatusAtom = atom<DivaSidecarStatus>({ state: 'idle', found: false })
divaSidecarStatusAtom.debugLabel = "divaSidecarStatusAtom"

// Gruppierung der Dateiliste nach einem Annotation-Attribut (z.B. 'stoffgruppe').
// null = keine Gruppierung. Generisch: jeder String-Attribut-Key ist moeglich.
export const groupByAttributeAtom = atom<string | null>(null)
groupByAttributeAtom.debugLabel = "groupByAttributeAtom"

// Sortiert & gefiltert (nur Dateien)
export const sortedFilteredFilesAtom = atom((get) => {
  const files = get(filesOnlyAtom)
  const searchTerm = get(searchTermAtom).toLowerCase()
  const sortField = get(sortFieldAtom)
  const sortOrder = get(sortOrderAtom)

  // Importiere die Filter-Funktionen
  const categoryFilter = get(fileCategoryFilterAtom)
  const annotationFilter = get(annotationFilterModeAtom)
  const annotations = get(itemAnnotationsAtom)
  const activeLibrary = get(activeLibraryAtom)
  const divaEnabled = activeLibrary?.config?.analyzeDivaTextureInfo === true

  let filtered = files.filter(item => {
    // Basis-Filter
    const basicFilter = !item.metadata.name.startsWith('.') &&
      !item.metadata.isTwin &&
      (searchTerm === '' || item.metadata.name.toLowerCase().includes(searchTerm))

    if (!basicFilter) return false

    // DIVA-Filter: immer nur *_basecolor, dann alle / mit / ohne Sidecar-Treffer.
    if (divaEnabled) {
      if (!isBasecolorFileName(item.metadata.name)) return false
      const hasAnnotation = annotations.has(item.metadata.name)
      if (annotationFilter === 'with' && !hasAnnotation) return false
      if (annotationFilter === 'without' && hasAnnotation) return false
    } else if (annotationFilter !== 'all') {
      // Generischer Annotation-Filter ohne DIVA (kein Basecolor-Zwang).
      const hasAnnotation = annotations.has(item.metadata.name)
      if (annotationFilter === 'with' && !hasAnnotation) return false
      if (annotationFilter === 'without' && hasAnnotation) return false
    }

    // Kategorie-Filter
    if (categoryFilter === 'all') return true

    const itemCategory = getFileCategory(item)
    return itemCategory === categoryFilter
  })

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

// Review-Mode-Atoms für das neue Layout-Feature
export const reviewModeAtom = atom<boolean>(false)
reviewModeAtom.debugLabel = "reviewModeAtom"

// Ausgewähltes Shadow-Twin für Review-Modus
export const selectedShadowTwinAtom = atom<StorageItem | null>(null)
selectedShadowTwinAtom.debugLabel = "selectedShadowTwinAtom"
