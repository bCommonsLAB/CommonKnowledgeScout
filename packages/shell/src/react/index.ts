/**
 * `@ks/shell/react` — Client-Oberflaeche der Schale (Modul-Landkarte §1,
 * Schicht 2).
 *
 * Die Auswahl-Atome bleiben BEWUSST paketintern (Entscheidung aus
 * Landkarte §6, Muster aus `@ks/i18n/react`): Ein exportiertes Atom bindet
 * jeden Konsumenten an dieselbe Jotai-Instanz und macht das Paket in einer
 * Fremdanwendung unbrauchbar. Nach aussen gibt es Hooks — und fuer Tests
 * `@ks/shell/testing`.
 */

export {
  useLibraries,
  useSetLibraries,
  useActiveLibraryId,
  useSetActiveLibraryId,
  useActiveLibrary,
  useNoLibrarySelected,
  useLibraryStatus,
  useSetLibraryStatus,
} from './hooks'
export type { LibrarySelectionState, LibraryStatus } from './library-selection-atom'
export { registerActiveLibraryChangeEffect } from './library-change-effects'
export type { ActiveLibraryChangeEffect } from './library-change-effects'
