/**
 * @fileoverview Regeln der globalen Modell-Liste (reine Funktionen, ohne Datenbank).
 *
 * @description
 * - Ein Modell wird nur aktiv geschaltet, wenn seine letzte Probe ueber den
 *   Secretary geklappt hat — das ist der Beleg, dass es dort laeuft.
 * - Mindestens ein Modell bleibt aktiv; sonst haetten Story-Modus und
 *   Library-Einstellungen keine Auswahl mehr.
 * - Die Reihenfolge wird als ganze Liste gesetzt und lueckenlos 1..n
 *   nummeriert (kein Gleichstand mehr wie frueher bei order 1).
 *
 * @module llm-models
 */

import type { TargetLanguage } from '@/lib/chat/constants'
import type { ModellProbe } from '@/types/sprachmodell'

/** Fehler, die der Mensch beheben kann (Route antwortet 400 statt 500). */
export class SprachmodellFehler extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SprachmodellFehler'
  }
}

/** Sprachen, die neue Eintraege bekommen (wie die bisherigen Modelle). */
export const STANDARD_SPRACHEN: readonly TargetLanguage[] = [
  'global', 'de', 'en', 'it', 'fr', 'es', 'pt', 'nl', 'no', 'da', 'sv', 'fi',
  'pl', 'cs', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'zh', 'ko', 'ja',
  'hr', 'sr', 'bs', 'sl', 'sk', 'lt', 'lv', 'et', 'id', 'ms', 'hi', 'sw', 'yo', 'zu',
]

const MODELL_ID = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:~-]*$/i

/** Prueft die Form `anbieter/modell` und liefert den Anbieter. */
export function anbieterAus(modelId: string): string {
  if (!MODELL_ID.test(modelId)) throw new SprachmodellFehler(`Ungueltige Modell-Kennung "${modelId}" — erwartet "anbieter/modell"`)
  return modelId.split('/')[0]
}

/** Katalog-Name ohne Anbieter-Vorsatz: "DeepSeek: DeepSeek V4.1 Flash" → "DeepSeek V4.1 Flash". */
export function anzeigeName(katalogName: string): string {
  const doppelpunkt = katalogName.indexOf(': ')
  const ohne = doppelpunkt >= 0 ? katalogName.slice(doppelpunkt + 2) : katalogName
  return ohne.trim() || katalogName.trim()
}

interface AktivierungsStand {
  modelId: string
  isActive: boolean
  probe?: ModellProbe
}

/**
 * Wirft, wenn der Schalter nicht umgelegt werden darf.
 * @param alle alle Eintraege (fuer die Regel „mindestens eines bleibt aktiv")
 */
export function pruefeSchalter(modell: AktivierungsStand, aktiv: boolean, alle: readonly AktivierungsStand[]): void {
  if (aktiv && !modell.isActive && !modell.probe?.ok) {
    throw new SprachmodellFehler(`"${modell.modelId}" erst nach einer erfolgreichen Probe aktiv schalten`)
  }
  if (!aktiv && modell.isActive) {
    const andereAktive = alle.filter((m) => m.isActive && m.modelId !== modell.modelId).length
    if (andereAktive === 0) throw new SprachmodellFehler('Mindestens ein Modell muss aktiv bleiben')
  }
}

/**
 * Neue Positionen 1..n in der gewuenschten Reihenfolge. Die Liste muss genau
 * die vorhandenen Eintraege enthalten — nichts fehlt, nichts doppelt.
 */
export function neueReihenfolge(vorhanden: readonly string[], gewuenscht: readonly string[]): Map<string, number> {
  const soll = new Set(vorhanden)
  const ist = new Set(gewuenscht)
  if (ist.size !== gewuenscht.length) throw new SprachmodellFehler('Reihenfolge enthaelt ein Modell doppelt')
  const fehlt = vorhanden.filter((id) => !ist.has(id))
  const fremd = gewuenscht.filter((id) => !soll.has(id))
  if (fehlt.length > 0 || fremd.length > 0) {
    throw new SprachmodellFehler(`Reihenfolge passt nicht zur Liste (fehlt: ${fehlt.join(', ') || '–'}; unbekannt: ${fremd.join(', ') || '–'})`)
  }
  return new Map(gewuenscht.map((id, index) => [id, index + 1]))
}
