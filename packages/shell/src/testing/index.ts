/**
 * `@ks/shell/testing` — Zustand der Schale in einem Test setzen.
 *
 * Die Auswahl-Atome sind paketintern (siehe `@ks/shell/react`), damit niemand
 * ausserhalb der Schale eigene Atome davon ableitet. Tests brauchen den
 * Zustand aber VOR dem ersten Render, also ausserhalb von React — dafuer diese
 * eine Funktion. Sie ist die einzige Stelle, an der die Atome nach aussen
 * wirken, und bewusst auf Schreiben beschraenkt.
 */

import type { createStore } from 'jotai'
import type { ClientLibrary } from '@ks/contracts'
import {
  activeLibraryIdAtom,
  librariesAtom,
  libraryStatusAtom,
  type LibraryStatus,
} from '../react/library-selection-atom'

type JotaiStore = ReturnType<typeof createStore>

export interface LibrarySelectionSeed {
  libraries?: ClientLibrary[]
  activeLibraryId?: string
  status?: LibraryStatus
}

/**
 * Setzt Bibliotheken, aktive Auswahl und Ladezustand in einen Jotai-Store.
 * Weggelassene Felder bleiben unveraendert.
 *
 * Achtung: `activeLibraryId` laeuft durch denselben Setter wie zur Laufzeit und
 * loest damit die angemeldeten Wechsel-Effekte aus — genau wie im Betrieb.
 */
export function seedLibrarySelection(store: JotaiStore, seed: LibrarySelectionSeed): void {
  if (seed.libraries !== undefined) {
    store.set(librariesAtom, seed.libraries)
  }
  if (seed.activeLibraryId !== undefined) {
    store.set(activeLibraryIdAtom, seed.activeLibraryId)
  }
  if (seed.status !== undefined) {
    store.set(libraryStatusAtom, seed.status)
  }
}
