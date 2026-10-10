/**
 * @fileoverview Satz-Segmente beim Schreiben einer Korrektur mitfuehren (Server).
 *
 * @description
 * Zwei Aufgaben rund um `POST transcript-correction`:
 * - `sprecherwechselErsetzungen`: Sprecherwechsel („ab Satz n spricht X") in
 *   Transkript-Ersetzungen uebersetzen — der Satztext kommt aus den Segmenten.
 * - `zieheSegmenteNach`: nach dem Schreiben dieselben Text-Ersetzungen und die
 *   Sprecher in die Segmente uebernehmen, damit die Lese-Ansicht den Stand zeigt.
 *   Das Transkript ist dann schon geschrieben — ein Fehler hier bricht nicht ab,
 *   steht aber im Log und in der Antwort (`fehler`).
 *
 * @module transkript-verlaesslichkeit
 */

import { FileLogger } from '@/lib/debug/logger'
import { getTranscriptSegments, updateTranscriptSegmentTexts } from '@/lib/repositories/transcript-segments-repo'
import { wendeErsetzungenAufSegmenteAn, type SegmentErsetzung } from './segmente-korrektur'
import { ersetzungFuerSprecherwechsel, mitSprecher, type Sprecherwechsel } from './sprecher-wechsel'

/** Liest `sprecherWechsel` aus dem Request-Body; Fehltypen sind ein Client-Fehler (String). */
export function sprecherwechselLesen(value: unknown): Sprecherwechsel[] | string {
  if (value === undefined) return []
  if (!Array.isArray(value)) return 'sprecherWechsel muss eine Liste sein'
  const out: Sprecherwechsel[] = []
  for (const [i, e] of value.entries()) {
    const o = e && typeof e === 'object' ? (e as Record<string, unknown>) : null
    if (!o || typeof o['satzIndex'] !== 'number' || !Number.isInteger(o['satzIndex']) || typeof o['name'] !== 'string') {
      return `sprecherWechsel[${i}]: satzIndex (Zahl) und name (String) erforderlich`
    }
    out.push({ satzIndex: o['satzIndex'], name: o['name'] })
  }
  return out
}

export async function sprecherwechselErsetzungen(libraryId: string, sourceId: string, wechsel: readonly Sprecherwechsel[]): Promise<SegmentErsetzung[]> {
  if (wechsel.length === 0) return []
  const doc = await getTranscriptSegments({ libraryId, sourceId })
  if (!doc) throw new Error('Keine Saetze gespeichert — Sprecherwechsel braucht die Satz-Segmente (neu transkribieren)')
  return wechsel.map((w) => {
    const satz = doc.segments[w.satzIndex]
    if (!satz) throw new Error(`Sprecherwechsel: Satz ${w.satzIndex} gibt es nicht`)
    return ersetzungFuerSprecherwechsel(satz.text, w.name)
  })
}

export async function zieheSegmenteNach(
  libraryId: string,
  sourceId: string,
  ersetzungen: readonly SegmentErsetzung[],
  wechsel: readonly Sprecherwechsel[],
): Promise<{ angewendet: number; nichtGefunden: number; sprecher: number } | { fehler: string } | null> {
  if (ersetzungen.length === 0 && wechsel.length === 0) return null
  try {
    const doc = await getTranscriptSegments({ libraryId, sourceId })
    if (!doc) return null
    const text = wendeErsetzungenAufSegmenteAn(doc.segments, ersetzungen)
    const segments = mitSprecher(text.segments, wechsel)
    if (text.angewendet > 0 || wechsel.length > 0) await updateTranscriptSegmentTexts({ libraryId, sourceId, segments })
    return { angewendet: text.angewendet, nichtGefunden: text.nichtGefunden.length, sprecher: wechsel.length }
  } catch (error) {
    const fehler = error instanceof Error ? error.message : String(error)
    FileLogger.error('transcript-correction', 'Segmente nicht nachgezogen', { libraryId, sourceId, error: fehler })
    return { fehler }
  }
}
