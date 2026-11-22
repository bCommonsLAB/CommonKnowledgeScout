/**
 * @fileoverview Antwort der Lese-Route des Teppichs (Plan `teppich-der-dokumente`, T1).
 *
 * @description
 * Reine Funktion: aus den Meta-Zeilen, die der Besucher sehen darf, die schlanke
 * Antwort fuer `GET /api/chat/<libraryId>/teppich`. Der Zustand ist benannt, nie
 * still: `nicht_berechnet` (kein Dokument hat eine Lage — der Hintergrund bleibt aus),
 * `veraltet` (einige Dokumente sind neu und haben noch keine Lage), `bereit`.
 *
 * @usedIn src/app/api/chat/[libraryId]/teppich/route.ts
 */

import { istTeppichInhalt, leseTeppichPunkt, type TeppichMetaZeile, type TeppichPunkt } from './teppich-felder'

export type TeppichZustand = 'bereit' | 'veraltet' | 'nicht_berechnet'

export interface TeppichAntwort {
  zustand: TeppichZustand
  /** Zeitpunkt des juengsten Laufs; `null` ohne Lage. */
  stand: string | null
  /** Sichtbare Inhalte (ohne Seiten der Website). */
  gesamt: number
  /** Davon ohne Lage (seit dem letzten Lauf dazugekommen). */
  ohneLage: number
  items: TeppichPunkt[]
}

export function baueTeppichAntwort(zeilen: TeppichMetaZeile[]): TeppichAntwort {
  const inhalte = zeilen.filter(istTeppichInhalt)
  const items: TeppichPunkt[] = []
  let stand: string | null = null
  for (const zeile of inhalte) {
    const punkt = leseTeppichPunkt(zeile)
    if (!punkt) continue
    items.push(punkt)
    const s = zeile.docMetaJson?.teppich_stand
    if (typeof s === 'string' && (stand === null || s > stand)) stand = s
  }
  const ohneLage = inhalte.length - items.length
  const zustand: TeppichZustand = items.length === 0 ? 'nicht_berechnet' : ohneLage > 0 ? 'veraltet' : 'bereit'
  return { zustand, stand, gesamt: inhalte.length, ohneLage, items }
}
