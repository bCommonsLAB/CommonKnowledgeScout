/**
 * @fileoverview Library-Auswahl — welche Bibliotheken es gibt und welche aktiv ist.
 *
 * @description
 * Der Bootstrap-Zustand der Schale (Modul-Landkarte §1, Schicht 2): die Liste
 * der Bibliotheken des Nutzers und die gerade gewaehlte. Bewusst getrennt vom
 * Ordner-/Dateizustand des Archivs (`@/atoms/folder-navigation`,
 * `@/atoms/library-atom`) — der gehoert spaeter nach `@ks/module-archive`,
 * waehrend diese Datei nach `@ks/shell` wandert.
 *
 * @module library
 */

import { atom } from "jotai"
import { ClientLibrary } from "@/types/library"
import { galleryFiltersAtom } from '@/atoms/gallery-filters'

/** Auswahl-Zustand: Liste + aktive Bibliothek. Mehr haelt dieses Atom nicht. */
export interface LibraryState {
  libraries: ClientLibrary[];
  activeLibraryId: string;
}

const initialState: LibraryState = {
  libraries: [],
  activeLibraryId: ""
}

// Hauptatom fuer den Auswahl-Zustand
export const libraryAtom = atom<LibraryState>(initialState)
libraryAtom.debugLabel = "libraryAtom"

// Derivierte Atome für spezifische Eigenschaften
export const activeLibraryIdAtom = atom(
  get => get(libraryAtom).activeLibraryId,
  (get, set, newId: string) => {
    const prev = get(libraryAtom).activeLibraryId
    set(libraryAtom, {
      ...get(libraryAtom),
      activeLibraryId: newId
    })
    // Galerie-/Story-Filter (Facetten, shortTitle, …) sind an die aktive Library gebunden.
    // Beim Wechsel zurücksetzen, damit keine Filter der vorherigen Library „hängen bleiben“.
    if (newId !== prev) {
      set(galleryFiltersAtom, {})
    }
  }
)
activeLibraryIdAtom.debugLabel = "activeLibraryIdAtom"

// Klares Signal fuer den "keine Library gewaehlt"-Zustand: true, solange keine
// aktive Library gesetzt ist (z.B. nach dem Login ohne gespeicherte Auswahl oder
// nach dem Deselektieren im Re-Auth-Dialog). UI/Guards pruefen dieses Atom statt
// ueberall activeLibraryId === "" zu streuen.
export const noLibrarySelectedAtom = atom(get => get(activeLibraryIdAtom) === "")
noLibrarySelectedAtom.debugLabel = "noLibrarySelectedAtom"

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

// Library Status (für Template Management)
export const libraryStatusAtom = atom<'ready' | 'waitingForAuth' | 'loading'>('loading')
libraryStatusAtom.debugLabel = "libraryStatusAtom"
