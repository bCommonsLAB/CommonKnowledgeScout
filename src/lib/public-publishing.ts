/**
 * @fileoverview Public Publishing Utilities
 *
 * Kleine, pure Helferfunktionen für Public-Publishing-Konfiguration.
 * Diese sind bewusst ohne Nebenwirkungen, damit sie einfach unit-testbar bleiben.
 */

/**
 * Entscheidet, ob eine Library auf der Homepage gelistet werden soll.
 *
 * Regel (Backwards-Compatibility):
 * - Wenn das Flag fehlt, gilt es als `true` (bisheriges Verhalten bleibt gleich).
 * - Nur ein explizites `false` blendet die Library auf der Homepage aus.
 */
export function shouldShowOnHomepage(showOnHomepage: boolean | undefined): boolean {
  return showOnHomepage !== false;
}















