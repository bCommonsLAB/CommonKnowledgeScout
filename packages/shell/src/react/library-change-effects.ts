/**
 * Was die Anwendung beim Wechsel der aktiven Bibliothek zusaetzlich tun will.
 *
 * WARUM: Der Wechsel zieht Folgen nach sich, die die Schale nicht kennen darf.
 * Heute setzt die Anwendung die Galerie-/Story-Filter zurueck — die haengen an
 * der Bibliothek und duerften sonst „haengen bleiben". Wuerde die Schale dafuer
 * `@/atoms/gallery-filters` importieren, griffe ein Paket zurueck in die App
 * (Modul-Landkarte §4 verbietet das).
 *
 * WIE: Wie bei `packages/viewers/src/logger.ts` reicht die Anwendung herein,
 * WAS zu tun ist. Ohne Registrierung passiert nichts — die Schale bleibt
 * lauffaehig.
 *
 * Der Effekt bekommt den Jotai-`set` der laufenden Schreiboperation. Das ist
 * kein Durchreichen des Stores, sondern die Bedingung dafuer, dass Wechsel und
 * Folge in EINER Transaktion passieren: ein nachgelagerter Effect wuerde einen
 * Zwischenzustand mit neuer Bibliothek und alten Filtern rendern.
 */

import type { Setter } from 'jotai'

/** `previous` ist die vorher aktive Bibliothek, `next` die neue. */
export type ActiveLibraryChangeEffect = (set: Setter, next: string, previous: string) => void

const effects = new Set<ActiveLibraryChangeEffect>()

/**
 * Meldet einen Effekt an. Gibt die Abmeldung zurueck (fuer Tests und
 * Hot-Reload; ohne sie wuerde derselbe Effekt mehrfach laufen).
 */
export function registerActiveLibraryChangeEffect(effect: ActiveLibraryChangeEffect): () => void {
  effects.add(effect)
  return () => {
    effects.delete(effect)
  }
}

/** Paket-intern: laeuft im Schreib-Atom, nicht nach aussen exportiert. */
export function runActiveLibraryChangeEffects(set: Setter, next: string, previous: string): void {
  for (const effect of effects) {
    effect(set, next, previous)
  }
}
