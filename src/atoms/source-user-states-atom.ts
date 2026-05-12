/**
 * @fileoverview Source-User-States State (Jotai)
 *
 * @description
 * Per-User-Zustand fuer Quell-Sterne und privaten "nicht wichtig"-
 * Marker. Wird vom `useUserStates`-Hook gelesen und beschrieben - das
 * vermeidet divergierende lokale States, wenn der Hook in mehreren
 * Komponenten gleichzeitig verwendet wird (z.B. Star-Spalte in der
 * Tabelle UND Tinder-Modus im Detail-Overlay).
 *
 * @module atoms
 */

import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'

export interface SourceUserStatesState {
  /** Set der `fileIds`, die der aktuelle User als Stern markiert hat. */
  favoriteIds: Set<string>
  /** Set der `fileIds`, die der aktuelle User als "nicht wichtig" markiert hat. */
  notImportantIds: Set<string>
  /** true sobald der initiale Fetch abgeschlossen ist. */
  isReady: boolean
  /** Letzte Fehlermeldung (Fetch oder setState). */
  error: string | null
}

const initial: SourceUserStatesState = {
  favoriteIds: new Set<string>(),
  notImportantIds: new Set<string>(),
  isReady: false,
  error: null,
}

/**
 * Family pro `libraryId`. Mehrere Hook-Instanzen fuer dieselbe Library
 * teilen sich denselben State - State-Aenderungen in der Tabelle
 * propagieren so automatisch in den Tinder-Modus und umgekehrt.
 */
export const sourceUserStatesAtomFamily = atomFamily((_libraryId: string) =>
  atom<SourceUserStatesState>(initial),
)
