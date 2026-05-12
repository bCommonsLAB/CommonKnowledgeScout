/**
 * @fileoverview Source-Favorites State (Jotai)
 *
 * @description
 * Zentraler State fuer geteilte Quell-Favoriten pro Library.
 * Wird vom `useSourceFavorites`-Hook gelesen und beschrieben - das vermeidet
 * divergierende lokale States, wenn der Hook in mehreren Komponenten
 * gleichzeitig verwendet wird (z.B. Star-Spalte in der Tabelle UND
 * Favoriten-Filter in `gallery-root`).
 *
 * @module atoms
 */

import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'

export interface SourceFavoritesState {
  /** Set der aktuell favorisierten fileIds. */
  ids: Set<string>
  /** true sobald der initiale Fetch abgeschlossen ist. */
  isReady: boolean
  /** Letzte Fehlermeldung (Fetch oder Toggle). */
  error: string | null
}

const initial: SourceFavoritesState = {
  ids: new Set<string>(),
  isReady: false,
  error: null,
}

/**
 * Family pro `libraryId`. Mehrere Hook-Instanzen fuer dieselbe Library
 * teilen sich denselben State - Toggles in der Tabelle propagieren so
 * automatisch in den Filter und umgekehrt.
 */
export const sourceFavoritesAtomFamily = atomFamily((_libraryId: string) =>
  atom<SourceFavoritesState>(initial),
)
