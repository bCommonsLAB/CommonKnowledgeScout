'use client'

/**
 * Hook-Oberflaeche der Library-Auswahl.
 *
 * Getrennte Lese- und Schreib-Hooks statt eines `useAtom`-Tupels: Wer nur
 * liest, soll nicht neu rendern, wenn sich nur der Setter-Vertrag aendert — und
 * die meisten Aufrufer lesen nur.
 */

import { useAtomValue, useSetAtom } from 'jotai'
import type { ClientLibrary } from '@ks/contracts'
import {
  activeLibraryAtom,
  activeLibraryIdAtom,
  librariesAtom,
  libraryStatusAtom,
  noLibrarySelectedAtom,
  type LibraryStatus,
} from './library-selection-atom'

/** Alle Bibliotheken des angemeldeten Nutzers (eigene und geteilte). */
export function useLibraries(): ClientLibrary[] {
  return useAtomValue(librariesAtom)
}

/** Setzt die Liste — nach dem Laden im Bootstrap oder nach dem Anlegen. */
export function useSetLibraries(): (libraries: ClientLibrary[]) => void {
  return useSetAtom(librariesAtom)
}

/** Id der aktiven Bibliothek; '' solange keine gewaehlt ist. */
export function useActiveLibraryId(): string {
  return useAtomValue(activeLibraryIdAtom)
}

/**
 * Wechselt die aktive Bibliothek. Loest die angemeldeten Wechsel-Effekte aus
 * (siehe `registerActiveLibraryChangeEffect`).
 */
export function useSetActiveLibraryId(): (id: string) => void {
  return useSetAtom(activeLibraryIdAtom)
}

/** Die aktive Bibliothek selbst; `undefined`, wenn keine gewaehlt ist. */
export function useActiveLibrary(): ClientLibrary | undefined {
  return useAtomValue(activeLibraryAtom)
}

/**
 * `true`, solange keine Bibliothek gewaehlt ist. Guards pruefen diesen Hook,
 * statt ueberall `activeLibraryId === ''` zu streuen.
 */
export function useNoLibrarySelected(): boolean {
  return useAtomValue(noLibrarySelectedAtom)
}

/** Ladezustand des Bootstraps. */
export function useLibraryStatus(): LibraryStatus {
  return useAtomValue(libraryStatusAtom)
}

/** Setzt den Ladezustand — Sache des Bootstraps, nicht der Ansichten. */
export function useSetLibraryStatus(): (status: LibraryStatus) => void {
  return useSetAtom(libraryStatusAtom)
}
