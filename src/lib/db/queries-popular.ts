/**
 * Meistgestellte Fragen einer Library aus dem Fragen-Log (Owner 09.11.2026,
 * Block `<!-- popular -->` der Story-Sektion).
 *
 * Gezaehlt werden Fragen der Personen (keine Themenuebersicht, kein
 * Systemtext) der letzten `tage` Tage, nach normalisiertem Text gruppiert
 * (Kleinschreibung, Leerraum, Satzzeichen am Ende). Zurueck kommt der
 * zuerst gesehene Originaltext je Gruppe mit Zaehler — keine Antworten, keine
 * Sitzungen, keine Personen: der Endpunkt ist anonym lesbar.
 */

import { STORY_TOC_QUESTION } from '@ks/contracts'
import { getQueriesCollection } from './queries-repo'

export interface PopulaereFrage {
  question: string
  count: number
}

/** Was je Eintrag gelesen wird — Themenuebersichten tragen `toc` (neu in cacheParams, alt an der Wurzel). */
export interface FrageZeile {
  question: string
  queryType?: string
  cacheParams?: { queryType?: string }
}

/** Normalform zum Gruppieren: klein, ein Leerzeichen, ohne Satzzeichen am Ende. */
export function normalisiereFrage(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?!.…\s]+$/u, '')
}

/** Reine Zaehlung (testbar): Zeilen → die `limit` haeufigsten Fragen, Originaltext der ersten Nennung. */
export function zaehleFragen(zeilen: ReadonlyArray<FrageZeile>, limit: number): PopulaereFrage[] {
  const gruppen = new Map<string, PopulaereFrage>()
  for (const z of zeilen) {
    if ((z.cacheParams?.queryType ?? z.queryType) === 'toc') continue
    const text = (z.question ?? '').trim()
    if (!text || text === STORY_TOC_QUESTION) continue
    const schluessel = normalisiereFrage(text)
    if (!schluessel) continue
    const g = gruppen.get(schluessel)
    if (g) g.count += 1
    else gruppen.set(schluessel, { question: text, count: 1 })
  }
  return [...gruppen.values()].sort((a, b) => b.count - a.count || a.question.localeCompare(b.question)).slice(0, limit)
}

/** Hoechstens so viele juengste Eintraege werden gezaehlt — genug fuer eine Rangliste, begrenzt fuer den Server. */
const MAX_ZEILEN = 2000

export async function listPopularQuestions(args: { libraryId: string; tage: number; limit: number }): Promise<PopulaereFrage[]> {
  const col = await getQueriesCollection()
  const seit = new Date(Date.now() - args.tage * 24 * 60 * 60 * 1000)
  const rows = (await col
    .find({ libraryId: args.libraryId, createdAt: { $gte: seit } }, { projection: { _id: 0, question: 1, queryType: 1, 'cacheParams.queryType': 1 }, sort: { createdAt: -1 }, limit: MAX_ZEILEN })
    .toArray()) as unknown as FrageZeile[]
  return zaehleFragen(rows, args.limit)
}
