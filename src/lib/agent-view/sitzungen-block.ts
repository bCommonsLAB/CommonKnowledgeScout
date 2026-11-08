/**
 * @fileoverview Block „Sitzungen" in `BERICHT.md` setzen (S1).
 *
 * @description
 * Der erzeugte Block steht zwischen `<!-- sitzungen:start/end -->`; der Rest
 * des Berichts bleibt byteidentisch (wie der Erschliessungs-Block im
 * `_INDEX.md`). Altbestand: 14 Berichte tragen einen handgeschriebenen Block
 * „### Sitzungen aus Claude Code (nachgetragen …)" bzw. „### Sitzungen mit
 * Claude (nachgetragen …)". Der wird NUR mit `alteBloeckeUebernehmen` an Ort
 * und Stelle durch den erzeugten Block ersetzt (Owner-Entscheid E2); ohne
 * den Schalter bleibt er stehen und der Aufrufer meldet einen Befund —
 * kein stiller Umbau (`no-silent-fallbacks.md`). Reine Funktionen.
 *
 * @module agent-view
 */

import { ersetzeBlock } from './erschliessung-block'
import { SITZUNGEN_BLOCK_END, SITZUNGEN_BLOCK_START } from './sichten/sitzungen-render'

/** Handgeschriebene Ueberschrift des Altbestands (Skill `sitzung-abschliessen`, bis 08.11.2026). */
const ALTE_UEBERSCHRIFT = /^### Sitzungen (?:aus Claude Code|mit Claude) \(nachgetragen[^)\n]*\)[ \t]*$/m
/** Naechste Ueberschrift der Ebenen 1-3 beendet den alten Block (Ebene 4 gehoert dazu). */
const NAECHSTE_UEBERSCHRIFT = /^#{1,3} /m

export interface AlterBlock {
  /** Zeichenposition der Ueberschrift. */
  start: number
  /** Position der naechsten Ueberschrift (Ebene 1-3) oder Textende — exklusiv. */
  end: number
  ueberschrift: string
}

/** Findet den handgeschriebenen Block; null = keiner. */
export function alterSitzungenBlock(text: string): AlterBlock | null {
  const match = ALTE_UEBERSCHRIFT.exec(text)
  if (!match) return null
  const start = match.index
  const inhaltAb = start + match[0].length
  const naechste = text.slice(inhaltAb).search(NAECHSTE_UEBERSCHRIFT)
  return { start, end: naechste === -1 ? text.length : inhaltAb + naechste, ueberschrift: match[0].trim() }
}

export type AlterBlockStatus = 'keiner' | 'ersetzt' | 'belassen'

export interface BerichtBlockErgebnis {
  text: string
  /** `belassen` = alter Block steht noch (Schalter fehlte) — ein Befund fuer den Aufrufer. */
  alterBlock: AlterBlockStatus
  alteUeberschrift: string | null
}

/**
 * Setzt den Block in den Berichtstext.
 * - Marker vorhanden → Block dazwischen erneuert.
 * - Alter Block ohne Schalter → Text UNVERAENDERT (bzw. nur der Marker-Block erneuert), Status `belassen`.
 * - Alter Block mit Schalter → an seiner Stelle der neue Block; ein zusaetzlicher
 *   Marker-Block gewinnt, der alte wird dann entfernt.
 * - Weder noch → Block ans Ende.
 */
export function berichtMitSitzungenBlock(text: string, block: string, alteBloeckeUebernehmen: boolean): BerichtBlockErgebnis {
  const alt = alterSitzungenBlock(text)
  const hatMarker = text.includes(SITZUNGEN_BLOCK_START)
  if (alt === null) {
    return { text: ersetzeBlock(text, SITZUNGEN_BLOCK_START, SITZUNGEN_BLOCK_END, block), alterBlock: 'keiner', alteUeberschrift: null }
  }
  if (!alteBloeckeUebernehmen) {
    const neu = hatMarker ? ersetzeBlock(text, SITZUNGEN_BLOCK_START, SITZUNGEN_BLOCK_END, block) : text
    return { text: neu, alterBlock: 'belassen', alteUeberschrift: alt.ueberschrift }
  }
  if (hatMarker) {
    const ohneAlt = text.slice(0, alt.start) + text.slice(alt.end)
    return { text: ersetzeBlock(ohneAlt, SITZUNGEN_BLOCK_START, SITZUNGEN_BLOCK_END, block), alterBlock: 'ersetzt', alteUeberschrift: alt.ueberschrift }
  }
  const vorher = text.slice(0, alt.start)
  const nachher = text.slice(alt.end)
  return { text: `${vorher}${block}${nachher === '' ? '\n' : '\n\n'}${nachher}`, alterBlock: 'ersetzt', alteUeberschrift: alt.ueberschrift }
}
