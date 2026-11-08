/**
 * @fileoverview Welche Frage die Story-Sektion der Startseite zeigt.
 *
 * @description
 * Owner-Entscheid 08.11.2026: Die Startseite verhaelt sich wie eine Suche,
 * nicht wie ein Chat. Sichtbar ist nur das JUENGSTE Frage-Antwort-Paar der
 * Sitzung; eine neue Frage ersetzt die Anzeige. Die Sitzung selbst bleibt
 * vollstaendig (geteilt mit dem Story-Modus, dort steht die Chronik), nichts
 * wird geloescht. Reine Funktion ohne React, damit sie testbar ist.
 *
 * @module website
 */

export interface SichtbaresPaar<P> {
  /** Das juengste Paar — oder null, wenn die Sitzung noch keine Frage hat. */
  paar: P | null
  /** Wie viele aeltere Paare die Sitzung noch traegt (fuer den Verweis auf den Story-Modus). */
  fruehere: number
}

/**
 * Nimmt aus den Paaren der Sitzung (aelteste zuerst, wie `paare()` aus
 * `@ks/module-story`) das letzte. Eine laufende Frage ohne Antwort ist dort
 * schon das letzte Paar und damit das sichtbare.
 */
export function sichtbaresPaar<P>(paare: ReadonlyArray<P>): SichtbaresPaar<P> {
  if (paare.length === 0) return { paar: null, fruehere: 0 }
  return { paar: paare[paare.length - 1], fruehere: paare.length - 1 }
}
