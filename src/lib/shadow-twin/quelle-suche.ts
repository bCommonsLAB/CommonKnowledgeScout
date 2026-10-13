/**
 * @fileoverview Quelle ueber Library-Grenzen wiedererkennen (Wunschliste 8, W8-2) — pur.
 *
 * @description
 * Bewertet, ob ein Twin-Dokument einer (anderen) Library dieselbe Quelle
 * meint. Rangfolge der Uebereinstimmung:
 *
 * 1. `hash` — beide tragen eine Quellkennung (`quellkennung.ts`), und sie ist
 *    gleich. Der Name darf abweichen (umbenannt).
 * 2. `name_groesse` — gleicher Name, beide Groessen bekannt und gleich.
 * 3. `name` — gleicher Name, mindestens eine Groesse unbekannt.
 *
 * Belegt verschieden ist ein Kandidat mit gleichem Namen, aber anderer
 * Kennung oder anderer Groesse — er wird genannt (`verschieden`), nicht als
 * Treffer gezaehlt. Namen werden exakt verglichen: Eine Kopie behaelt ihren
 * Namen, und eine Unschaerfe hier waere Raten.
 *
 * @module shadow-twin
 */

export type Uebereinstimmung = 'hash' | 'name_groesse' | 'name'

export const RANG_UEBEREINSTIMMUNG: Record<Uebereinstimmung, number> = { hash: 0, name_groesse: 1, name: 2 }

/** Was ueber die gesuchte Quelle bekannt ist; null = unbekannt. */
export interface Suchmerkmale {
  name: string | null
  hash: string | null
  groesse: number | null
}

/** Was ueber einen Kandidaten bekannt ist (Twin-Dokument, ggf. Listing). */
export interface KandidatMerkmale {
  sourceName: string
  sourceContentHash: string | null
  sourceSize: number | null
}

export type Bewertung =
  | { art: Uebereinstimmung }
  | { art: 'verschieden'; grund: string }
  | { art: 'kein_treffer' }

export function bewerteTreffer(such: Suchmerkmale, kandidat: KandidatMerkmale): Bewertung {
  const nameGleich = such.name !== null && kandidat.sourceName === such.name
  if (such.hash !== null && kandidat.sourceContentHash !== null) {
    if (such.hash === kandidat.sourceContentHash) return { art: 'hash' }
    return nameGleich ? { art: 'verschieden', grund: 'gleicher Name, anderer Inhalt (Quellkennung verschieden)' } : { art: 'kein_treffer' }
  }
  if (!nameGleich) return { art: 'kein_treffer' }
  if (such.groesse !== null && kandidat.sourceSize !== null) {
    return such.groesse === kandidat.sourceSize
      ? { art: 'name_groesse' }
      : { art: 'verschieden', grund: `gleicher Name, andere Groesse (${such.groesse} gegen ${kandidat.sourceSize} Bytes)` }
  }
  return { art: 'name' }
}

/** Eine Quelle, fuer die der Scan nach Orten in anderen Libraries fragt. */
export interface SuchQuelle {
  sourceId: string
  sourceName: string
  sourceContentHash: string | null
  sourceSize: number | null
}

/** Ein moeglicher Ort einer verschwundenen Quelle (Befund `quelle_verschwunden`). */
export interface MoeglicherOrt {
  libraryId: string
  libraryName: string
  /** `@<slug>` der Library; null = sie hat keinen gueltigen Slug. */
  bibliothek: string | null
  sourceId: string
  sourceName: string
  uebereinstimmung: Uebereinstimmung
}

/** Orte je Quelle, gekappt; `gesamt` sagt, wie viele es waren. */
export interface OrteJeQuelle {
  orte: MoeglicherOrt[]
  gesamt: number
}

/** Hoechstens so viele Orte je Quelle stehen im Befund. */
export const MAX_ORTE_JE_QUELLE = 5

/** Bessere Uebereinstimmung zuerst, dann Library-Name, dann Quellname. */
export function sortiereNachUebereinstimmung<T extends { uebereinstimmung: Uebereinstimmung; libraryName: string; sourceName: string }>(
  eintraege: readonly T[],
): T[] {
  return [...eintraege].sort(
    (a, b) =>
      RANG_UEBEREINSTIMMUNG[a.uebereinstimmung] - RANG_UEBEREINSTIMMUNG[b.uebereinstimmung] ||
      a.libraryName.localeCompare(b.libraryName) ||
      a.sourceName.localeCompare(b.sourceName),
  )
}
