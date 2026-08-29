'use client'

/**
 * Auswahl-Zustand der Schale: welche Bibliotheken es gibt, welche aktiv ist.
 *
 * Die Atome sind BEWUSST paketintern — `./index.ts` exportiert nur Hooks
 * (Entscheidung aus Modul-Landkarte §6, in M4c an `@ks/i18n/react` erstmals
 * durchgezogen). Ein exportiertes Atom bindet jeden Konsumenten an dieselbe
 * Jotai-Instanz; nach aussen gibt es deshalb nur Hooks. Wer den Zustand in
 * einem Test setzen muss, nimmt `@ks/shell/testing`.
 *
 * Der Ordner-/Dateizustand des Archivs gehoert NICHT hierher — er bleibt in
 * der Anwendung und geht spaeter nach `@ks/module-archive`.
 */

import { atom } from 'jotai'
import type { ClientLibrary } from '@ks/contracts'
import { runActiveLibraryChangeEffects } from './library-change-effects'

/** Auswahl-Zustand: Liste + aktive Bibliothek. Mehr haelt dieses Atom nicht. */
export interface LibrarySelectionState {
  libraries: ClientLibrary[]
  activeLibraryId: string
}

/** Ladezustand des Bootstraps — `waitingForAuth`, solange die Anmeldung fehlt. */
export type LibraryStatus = 'ready' | 'waitingForAuth' | 'loading'

const initialState: LibrarySelectionState = {
  libraries: [],
  activeLibraryId: '',
}

export const librarySelectionAtom = atom<LibrarySelectionState>(initialState)
librarySelectionAtom.debugLabel = 'librarySelectionAtom'

export const activeLibraryIdAtom = atom(
  get => get(librarySelectionAtom).activeLibraryId,
  (get, set, newId: string) => {
    const previous = get(librarySelectionAtom).activeLibraryId
    set(librarySelectionAtom, {
      ...get(librarySelectionAtom),
      activeLibraryId: newId,
    })
    // Folgen des Wechsels (z.B. Galerie-Filter zuruecksetzen) reicht die
    // Anwendung herein — in derselben Transaktion, damit kein Zwischenzustand
    // sichtbar wird.
    if (newId !== previous) {
      runActiveLibraryChangeEffects(set, newId, previous)
    }
  }
)
activeLibraryIdAtom.debugLabel = 'activeLibraryIdAtom'

export const librariesAtom = atom(
  get => get(librarySelectionAtom).libraries,
  (get, set, newLibraries: ClientLibrary[]) => {
    set(librarySelectionAtom, {
      ...get(librarySelectionAtom),
      libraries: newLibraries,
    })
  }
)
librariesAtom.debugLabel = 'librariesAtom'

export const activeLibraryAtom = atom(get => {
  const state = get(librarySelectionAtom)
  return state.libraries.find(lib => lib.id === state.activeLibraryId)
})
activeLibraryAtom.debugLabel = 'activeLibraryAtom'

// Klares Signal fuer den "keine Library gewaehlt"-Zustand: true, solange keine
// aktive Library gesetzt ist (z.B. nach dem Login ohne gespeicherte Auswahl
// oder nach dem Deselektieren im Re-Auth-Dialog). UI/Guards pruefen dieses
// Atom statt ueberall activeLibraryId === "" zu streuen.
export const noLibrarySelectedAtom = atom(get => get(activeLibraryIdAtom) === '')
noLibrarySelectedAtom.debugLabel = 'noLibrarySelectedAtom'

export const libraryStatusAtom = atom<LibraryStatus>('loading')
libraryStatusAtom.debugLabel = 'libraryStatusAtom'
