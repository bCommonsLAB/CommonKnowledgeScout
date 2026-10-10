/**
 * @fileoverview Bestaetigte Ersetzungen auch auf die gespeicherten Satz-Segmente anwenden.
 *
 * @description
 * Nach „Bestaetigen und schreiben" steht der korrigierte Text im Transkript.
 * Die Lese-Ansicht zeigt aber die Saetze aus den Segmenten — ohne Nachziehen
 * stuende dort weiter der alte Text. Rein: gleiche Regel wie im Transkript
 * (`alle` = jedes Vorkommen, sonst das erste), Werte und Zeiten bleiben die
 * des Laufs. Was in keinem Segment steht (z. B. ueber eine Satzgrenze hinweg),
 * wird gezaehlt und zurueckgemeldet, nicht still uebergangen.
 *
 * @module transkript-verlaesslichkeit
 */

import type { TranscriptSegment } from './segmente'

export interface SegmentErsetzung {
  alt: string
  neu: string
  alle?: boolean
}

export interface SegmentKorrekturErgebnis {
  segments: TranscriptSegment[]
  /** Ersetzungen, die in einem Segment angewendet wurden. */
  angewendet: number
  /** Ersetzungen, deren `alt` in keinem einzelnen Segment vorkommt. */
  nichtGefunden: string[]
}

export function wendeErsetzungenAufSegmenteAn(
  segments: readonly TranscriptSegment[],
  ersetzungen: readonly SegmentErsetzung[],
): SegmentKorrekturErgebnis {
  const neu = segments.map((s) => ({ ...s }))
  let angewendet = 0
  const nichtGefunden: string[] = []
  for (const e of ersetzungen) {
    if (!e.alt) continue
    let getroffen = false
    for (const s of neu) {
      if (!s.text.includes(e.alt)) continue
      s.text = e.alle === true ? s.text.split(e.alt).join(e.neu) : s.text.replace(e.alt, () => e.neu)
      getroffen = true
      if (e.alle !== true) break
    }
    if (getroffen) angewendet += 1
    else nichtGefunden.push(e.alt)
  }
  return { segments: neu, angewendet, nichtGefunden }
}
