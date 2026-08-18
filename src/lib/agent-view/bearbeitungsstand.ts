/**
 * @fileoverview Erklaerter Ordner-Stand (`bearbeitungsstand`) — Lesen und Ordnen.
 *
 * @description
 * Das Soll-Buch der doppelten Buchhaltung (Erschliessungszyklus §4). Die
 * Agentensicht LIEST diese Felder ausschliesslich — geschrieben wird nie
 * (Projektauftrag §2 Leitprinzip 6: erklaerte Staende werden nie still
 * korrigiert, der Widerspruch wird angezeigt).
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import { BEARBEITUNGSSTAND_VALUES, type Bearbeitungsstand } from './types'

const VALID_STAENDE: ReadonlySet<string> = new Set(BEARBEITUNGSSTAND_VALUES)

/** Rangfolge v2: ungesichtet → erschlossen → strukturiert → berichtet → abgenommen. */
const STAND_ORDER: ReadonlyMap<Bearbeitungsstand, number> = new Map(
  BEARBEITUNGSSTAND_VALUES.map((value, idx) => [value, idx]),
)

export function standRank(stand: Bearbeitungsstand): number {
  const rank = STAND_ORDER.get(stand)
  if (rank === undefined) throw new Error(`Unbekannter Bearbeitungsstand: ${String(stand)}`)
  return rank
}

/** Ist `stand` mindestens so weit wie `minimum`? */
export function isAtLeast(stand: Bearbeitungsstand | null, minimum: Bearbeitungsstand): boolean {
  if (stand === null) return false
  return standRank(stand) >= standRank(minimum)
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export interface ReadStandResult {
  bearbeitungsstand: Bearbeitungsstand | null
  /** ISO-Zeitstempel; reine Datumsangaben werden als Tagesende gelesen. */
  bearbeitungsstandSeit: string | null
  /** Gesetzt, wenn ein Wert da, aber unbrauchbar ist — kein stiller Default. */
  error?: string
}

/**
 * Liest `bearbeitungsstand` + `bearbeitungsstand_seit` aus flachem Frontmatter.
 *
 * Ein unbekannter Wert wird NICHT auf einen Default gebogen, sondern als
 * Fehler gemeldet (`no-silent-fallbacks.mdc`). `bearbeitungsstand_seit` wird
 * grosszuegig als Tagesende gelesen, damit eine Aenderung AM Stichtag den
 * Stand nicht sofort widerlegt (analog `isVerificationValid`).
 */
export function readBearbeitungsstand(meta: Record<string, unknown>): ReadStandResult {
  const rawStand = meta['bearbeitungsstand']
  const rawSeit = meta['bearbeitungsstand_seit']

  let bearbeitungsstand: Bearbeitungsstand | null = null
  let error: string | undefined

  if (rawStand !== undefined && rawStand !== null && String(rawStand).trim() !== '') {
    const value = String(rawStand).trim()
    if (VALID_STAENDE.has(value)) bearbeitungsstand = value as Bearbeitungsstand
    else error = `Unbekannter bearbeitungsstand: "${value}"`
  }

  let bearbeitungsstandSeit: string | null = null
  if (rawSeit !== undefined && rawSeit !== null && String(rawSeit).trim() !== '') {
    const raw = rawSeit instanceof Date ? rawSeit.toISOString() : String(rawSeit).trim()
    const iso = DATE_ONLY_RE.test(raw) ? `${raw}T23:59:59.999Z` : raw
    const ms = Date.parse(iso)
    if (Number.isNaN(ms)) {
      const detail = `Unlesbares bearbeitungsstand_seit: "${raw}"`
      error = error ? `${error}; ${detail}` : detail
    } else {
      bearbeitungsstandSeit = new Date(ms).toISOString()
    }
  }

  return { bearbeitungsstand, bearbeitungsstandSeit, ...(error ? { error } : {}) }
}
