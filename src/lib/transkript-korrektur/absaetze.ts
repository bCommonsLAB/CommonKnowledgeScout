/**
 * @fileoverview Transkript-Body in Absaetze mit Sprecher-Label zerlegen (P3b, Lesesicht).
 *
 * @description
 * Die Korrektur-Oberflaeche zeigt den Text links, Absatz fuer Absatz, mit dem
 * Sprecher-Label aus dem Praefix (`**Label:** Text`). Reine Funktion, kein I/O.
 * Ein Absatz ohne bekanntes Praefix bekommt `label: null` — er bleibt sichtbar,
 * wird aber keinem Sprecher zugeordnet (keine stille Zuordnung).
 *
 * @module transkript-korrektur
 */

import { sprecherPraefix } from './anwenden'

export interface TranskriptAbsatz {
  /** Laufende Nummer, 0-basiert — Anker fuer „zur ersten Stelle springen". */
  index: number
  /** Sprecher-Label aus dem Praefix; null, wenn der Absatz keinen bekannten Praefix traegt. */
  label: string | null
  /** Text ohne Praefix. */
  text: string
}

/** Zerlegt den Body an Leerzeilen; Labels werden nur erkannt, wenn sie in `speakers` stehen. */
export function zerlegeAbsaetze(body: string, speakers: readonly string[]): TranskriptAbsatz[] {
  const praefixe = speakers.map((label) => ({ label, praefix: sprecherPraefix(label) }))
  return body
    .split(/\n\s*\n/)
    .map((roh) => roh.trim())
    .filter((roh) => roh !== '')
    .map((roh, index) => {
      const treffer = praefixe.find((p) => roh.startsWith(p.praefix))
      if (!treffer) return { index, label: null, text: roh }
      return { index, label: treffer.label, text: roh.slice(treffer.praefix.length).trim() }
    })
}
