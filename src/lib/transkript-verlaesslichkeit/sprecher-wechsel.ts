/**
 * @fileoverview Sprecherwechsel ins Transkript schreiben — rein.
 *
 * @description
 * Ein uebernommener Sprecherwechsel beginnt im Markdown einen neuen Absatz mit
 * Praefix (`**Name:** Satz…`, dieselbe Form wie die Sprecher-Absaetze aus
 * `extract-audio-text.ts`). Im Transkript wird das als Ersetzung „Satz →
 * Absatzumbruch + Praefix + Satz" geschrieben (gleicher Schreibweg, alles oder
 * nichts); in den Segmenten steht der Sprecher am ersten Satz des Beitrags.
 *
 * @module transkript-verlaesslichkeit
 */

import type { TranscriptSegment } from './segmente'

export interface Sprecherwechsel {
  satzIndex: number
  name: string
}

/** Ersetzung fuer das Transkript: vor dem Satz einen neuen Absatz mit Sprecher beginnen. */
export function ersetzungFuerSprecherwechsel(satzText: string, name: string): { alt: string; neu: string } {
  const n = name.trim()
  if (!n) throw new Error('Sprecherwechsel ohne Namen')
  if (n.includes('*') || n.includes(':') || n.includes('\n')) throw new Error(`Sprechername „${n}" enthaelt * : oder Zeilenumbruch`)
  return { alt: satzText, neu: `\n\n**${n}:** ${satzText}` }
}

/** Segmente mit gesetztem Sprecher am ersten Satz des Beitrags; Index ausserhalb ist ein Fehler. */
export function mitSprecher(segments: readonly TranscriptSegment[], wechsel: readonly Sprecherwechsel[]): TranscriptSegment[] {
  const neu = segments.map((s) => ({ ...s }))
  for (const w of wechsel) {
    const s = neu[w.satzIndex]
    if (!s) throw new Error(`Sprecherwechsel: Satz ${w.satzIndex} gibt es nicht`)
    s.speaker = w.name.trim()
  }
  return neu
}
