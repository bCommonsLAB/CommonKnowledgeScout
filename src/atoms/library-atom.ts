/**
 * @fileoverview Datei-Listen- und Annotations-Zustand der Bibliothek.
 *
 * @description
 * Was die Dateiliste zeigt: geladene Items, Auswahl, Suche/Sortierung je
 * Library, Annotationen (DIVA und generisch) und der Review-Modus.
 *
 * Welche Bibliotheken es gibt und welche aktiv ist, steht seit dieser Welle
 * NICHT mehr hier, sondern in `@ks/shell/react` — dort als Hooks, nicht als
 * Atome. Die Ordner-Navigation liegt in `@/atoms/folder-navigation` und wird
 * hier re-exportiert, damit bestehende Importpfade gueltig bleiben
 * (Migrationsstrategie G2).
 *
 * @module library
 *
 * @usedIn
 * - src/contexts/storage-context.tsx: Uses library atoms for state management
 * - src/components/library: Library components use atoms
 * - src/hooks/use-storage-provider.tsx: Uses library atoms
 *
 * Die Filter-/Sortier-Regel und die Pfad-Berechnung sind seit dieser Welle
 * keine Atome mehr, sondern reine Funktionen in `@/lib/file-list/` mit den
 * Hooks in `@/hooks/use-file-list-view` davor — sie brauchen die aktive
 * Bibliothek, und die ist nach dem Umzug in die Schale nur ueber Hooks
 * erreichbar.
 *
 * @dependencies
 * - jotai: State management library
 * - @/lib/storage/types: StorageItem type
 */

import { atom } from "jotai"
import { atomFamily } from "jotai/utils"
import { StorageItem } from "@/lib/storage/types"

// Fassade auf die Ordner-Navigation (G2) — bestehende Importe bleiben gueltig.
export type { FolderNavigationState, LoadingState } from "@/atoms/folder-navigation"
export {
  folderNavigationAtom,
  currentFolderIdAtom,
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

// Review-Mode-Atoms für das neue Layout-Feature
export const reviewModeAtom = atom<boolean>(false)
reviewModeAtom.debugLabel = "reviewModeAtom"

// Ausgewähltes Shadow-Twin für Review-Modus
export const selectedShadowTwinAtom = atom<StorageItem | null>(null)
selectedShadowTwinAtom.debugLabel = "selectedShadowTwinAtom"
