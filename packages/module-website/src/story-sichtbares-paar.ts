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

/** Minimale Form eines Paars fuer die Kennungssuche (wie `FrageAntwort` aus `@ks/module-story`). */
export interface PaarMitKennung {
  frage: { queryId?: string }
  antwort?: { queryId?: string }
}

/**
 * Gespeicherte Kennung der juengsten FRUEHEREN, beantworteten Frage — das Ziel
 * des Verweises in den Story-Modus (`?mode=story&q=…`). Das sichtbare (letzte)
 * Paar zaehlt nicht; ohne beantwortete fruehere Frage null (dann zeigt der
 * Story-Modus seine Uebersicht).
 */
export function juengsteFruehereKennung(paare: ReadonlyArray<PaarMitKennung>): string | null {
  for (let i = paare.length - 2; i >= 0; i--) {
    const kennung = paare[i].antwort?.queryId ?? paare[i].frage.queryId
    if (kennung) return kennung
  }
  return null
}
