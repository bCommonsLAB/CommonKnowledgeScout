/**
 * @fileoverview Antwort der Lese-Route des Teppichs (Plan `teppich-der-dokumente`, T1/T5a).
 *
 * @description
 * Reine Funktion: aus den Meta-Zeilen, die der Besucher sehen darf, die schlanke
 * Antwort fuer `GET /api/chat/<libraryId>/teppich`. Der Zustand ist benannt, nie
 * still: `nicht_berechnet` (kein Dokument hat eine Lage — der Hintergrund bleibt aus),
 * `veraltet` (einige Dokumente sind neu und haben noch keine Lage), `bereit`.
 *
 * T5a: je Punkt zusaetzlich die Wolke (`wx`, `wy`) und die staerksten Nachbarn als Indizes in
 * `items` (hoechstens `NACHBARN_JE_PUNKT`, nur sichtbare) — fuer die Linien beim Ueberfahren.
 *
 * @usedIn src/app/api/chat/[libraryId]/teppich/route.ts
 */

import { istTeppichInhalt, leseTeppichPunkt, nachbarnAus, type TeppichMetaZeile, type TeppichPunkt } from './teppich-felder'

export type TeppichZustand = 'bereit' | 'veraltet' | 'nicht_berechnet'

/** So viele Nachbarn je Punkt liefert die Route (Linien, Plan §3.6, E9). */
export const NACHBARN_JE_PUNKT = 3

export interface TeppichAntwortPunkt extends TeppichPunkt {
  /** Staerkste Nachbarn als Indizes in `items`, staerkster zuerst. */
  nachbarn: number[]
}

export interface TeppichAntwort {
  zustand: TeppichZustand
  /** Zeitpunkt des juengsten Laufs; `null` ohne Lage. */
  stand: string | null
  /** Sichtbare Inhalte (ohne Seiten der Website). */
  gesamt: number
  /** Davon ohne Lage (seit dem letzten Lauf dazugekommen). */
  ohneLage: number
  items: TeppichAntwortPunkt[]
}

export function baueTeppichAntwort(zeilen: TeppichMetaZeile[]): TeppichAntwort {
  const inhalte = zeilen.filter(istTeppichInhalt)
  const items: TeppichAntwortPunkt[] = []
  const roh: Array<Array<{ fileId: string; weight: number }>> = []
  let stand: string | null = null
  for (const zeile of inhalte) {
    const punkt = leseTeppichPunkt(zeile)
    if (!punkt) continue
    items.push({ ...punkt, nachbarn: [] })
    roh.push(nachbarnAus(zeile.docMetaJson?.similarity_neighbors))
    const s = zeile.docMetaJson?.teppich_stand
    if (typeof s === 'string' && (stand === null || s > stand)) stand = s
  }
  // Nachbarn auf Indizes abbilden; unsichtbare (Entwurf, Website) fallen weg.
  const index = new Map(items.map((p, i) => [p.fileId, i]))
  items.forEach((p, i) => {
    p.nachbarn = [...roh[i]]
      .sort((a, b) => b.weight - a.weight || (a.fileId < b.fileId ? -1 : 1))
      .map((n) => index.get(n.fileId))
      .filter((j): j is number => j !== undefined && j !== i)
      .filter((j, k, alle) => alle.indexOf(j) === k)
      .slice(0, NACHBARN_JE_PUNKT)
  })
  const ohneLage = inhalte.length - items.length
  const zustand: TeppichZustand = items.length === 0 ? 'nicht_berechnet' : ohneLage > 0 ? 'veraltet' : 'bereit'
  return { zustand, stand, gesamt: inhalte.length, ohneLage, items }
}
