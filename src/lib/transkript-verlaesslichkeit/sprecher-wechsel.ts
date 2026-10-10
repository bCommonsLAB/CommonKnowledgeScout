/**
 * @fileoverview Sprecher am Satz setzen, umbenennen, entfernen — rein.
 *
 * @description
 * Ein Sprecher beginnt im Markdown einen neuen Absatz mit Praefix
 * (`**Name:** Satz…`, dieselbe Form wie die Sprecher-Absaetze aus
 * `extract-audio-text.ts`). Im Transkript laeuft das als Ersetzung ueber den
 * gemeinsamen Schreibweg (alles oder nichts); in den Segmenten steht der
 * Sprecher am ersten Satz des Beitrags. Drei Faelle an einem Satz:
 * - ohne Sprecher + Name  → setzen (Absatzumbruch + Praefix davor),
 * - mit Sprecher + Name   → umbenennen (nur das Praefix),
 * - mit Sprecher + null   → entfernen (Praefix und, wenn vorhanden, der
 *   Absatzumbruch davor — der Satz haengt dann wieder am vorigen Absatz).
 *
 * @module transkript-verlaesslichkeit
 */

import type { TranscriptSegment } from './segmente'

export interface Sprecherwechsel {
  satzIndex: number
  /** null = Sprecher an diesem Satz entfernen. */
  name: string | null
}

function pruefeName(name: string): string {
  const n = name.trim()
  if (!n) throw new Error('Sprecher ohne Namen')
  if (n.includes('*') || n.includes(':') || n.includes('\n')) throw new Error(`Sprechername „${n}" enthaelt * : oder Zeilenumbruch`)
  return n
}

export function sprecherPraefix(name: string): string {
  return `**${name}:**`
}

/**
 * Ersetzung fuer das Transkript. `markdown` wird nur beim Entfernen gelesen
 * (steht ein Absatzumbruch vor dem Praefix?), damit die Stelle eindeutig bleibt.
 */
export function ersetzungFuerSprecherwechsel(
  segment: Pick<TranscriptSegment, 'text' | 'speaker'>,
  name: string | null,
  markdown: string,
): { alt: string; neu: string } {
  const text = segment.text
  const aktuell = segment.speaker?.trim() || null
  if (name === null) {
    if (!aktuell) throw new Error('Kein Sprecher an diesem Satz — nichts zu entfernen')
    const mitPraefix = `${sprecherPraefix(aktuell)} ${text}`
    const mitUmbruch = `\n\n${mitPraefix}`
    if (!markdown.includes(mitPraefix)) throw new Error(`Sprecher „${aktuell}" steht nicht mehr vor diesem Satz — Seite neu laden`)
    return { alt: markdown.includes(mitUmbruch) ? mitUmbruch : mitPraefix, neu: text }
  }
  const neu = pruefeName(name)
  if (aktuell) {
    if (neu === aktuell) throw new Error('Sprecher ist schon so benannt — nichts zu tun')
    return { alt: `${sprecherPraefix(aktuell)} ${text}`, neu: `${sprecherPraefix(neu)} ${text}` }
  }
  return { alt: text, neu: `\n\n${sprecherPraefix(neu)} ${text}` }
}

/** Segmente mit gesetztem/umbenanntem/entferntem Sprecher; Index ausserhalb ist ein Fehler. */
export function mitSprecher(segments: readonly TranscriptSegment[], wechsel: readonly Sprecherwechsel[]): TranscriptSegment[] {
  const neu = segments.map((s) => ({ ...s }))
  for (const w of wechsel) {
    const s = neu[w.satzIndex]
    if (!s) throw new Error(`Sprecherwechsel: Satz ${w.satzIndex} gibt es nicht`)
    s.speaker = w.name === null ? null : pruefeName(w.name)
  }
  return neu
}
