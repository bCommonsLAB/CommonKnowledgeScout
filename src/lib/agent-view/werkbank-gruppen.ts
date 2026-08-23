/**
 * @fileoverview Gruppierung der Werkbank-Liste (F12, Welle W5) — pur.
 *
 * @description
 * Zweite Denk-Ebene neben der Ordnerstruktur (§11): die Liste gruppiert nach
 * **Bereich** (erstes Pfadsegment, W3-Verhalten unveraendert) oder nach
 * **Thema** (`themen` aus der VorhabenCard, W1). Bei Thema erscheint ein
 * Vorhaben unter JEDEM seiner Themen; Vorhaben ohne Themen — auch Karten aus
 * Scans vor W1 (`themen === undefined`) — landen in der benannten Gruppe
 * „Ohne Thema", sichtbar statt still verschluckt (Akzeptanzkriterium 10).
 * Themen-Gruppen sind alphabetisch sortiert, „Ohne Thema" steht zuletzt;
 * Bereichs-Gruppen folgen dem Erst-Auftreten in der (bereits sortierten)
 * Kartenliste. Gruppenkoepfe sind gewoehnliche Zeilen (§6.3).
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { VorhabenCard } from './types'
import { bereichVon } from './werkbank-filter'

export type WerkbankGruppierung = 'bereich' | 'thema'

/** Benannte Gruppe fuer Vorhaben ohne `themen` — nie unsichtbar (F12). */
export const OHNE_THEMA_GRUPPE = 'Ohne Thema'

export interface WerkbankZeileKopf {
  art: 'kopf'
  gruppe: string
  anzahl: number
}

export interface WerkbankZeileKarte {
  art: 'karte'
  card: VorhabenCard
  /** Eindeutig je Zeile: bei Thema-Gruppierung erscheint dieselbe Karte mehrfach. */
  zeilenKey: string
}

export type WerkbankZeile = WerkbankZeileKopf | WerkbankZeileKarte

/** Gruppen einer Karte — bei `thema` eine je Thema, sonst genau der Bereich. */
export function gruppenVon(card: VorhabenCard, gruppierung: WerkbankGruppierung): string[] {
  if (gruppierung === 'bereich') return [bereichVon(card)]
  if (card.themen === undefined || card.themen.length === 0) return [OHNE_THEMA_GRUPPE]
  return card.themen
}

/**
 * Baut das flache Zeilenmodell der virtualisierten Liste: je Gruppe ein Kopf,
 * darunter ihre Karten (innerhalb der Gruppe bleibt die uebergebene
 * Sortierung). Eingeklappte Gruppen behalten den Kopf, lassen die Karten aus.
 */
export function baueWerkbankZeilen(
  karten: readonly VorhabenCard[],
  gruppierung: WerkbankGruppierung,
  eingeklappt: ReadonlySet<string>,
): WerkbankZeile[] {
  const gruppen = new Map<string, VorhabenCard[]>()
  for (const card of karten) {
    for (const gruppe of gruppenVon(card, gruppierung)) {
      const bucket = gruppen.get(gruppe)
      if (bucket) bucket.push(card)
      else gruppen.set(gruppe, [card])
    }
  }

  // Bereich: Erst-Auftreten (deterministisch aus der sortierten Liste).
  // Thema: alphabetisch, „Ohne Thema" bewusst zuletzt — benannt, nicht vorn.
  const namen = [...gruppen.keys()]
  if (gruppierung === 'thema') {
    namen.sort((a, b) => {
      if (a === OHNE_THEMA_GRUPPE) return 1
      if (b === OHNE_THEMA_GRUPPE) return -1
      return a.localeCompare(b)
    })
  }

  const zeilen: WerkbankZeile[] = []
  for (const gruppe of namen) {
    const cards = gruppen.get(gruppe)
    if (!cards) continue
    zeilen.push({ art: 'kopf', gruppe, anzahl: cards.length })
    if (eingeklappt.has(gruppe)) continue
    for (const card of cards) {
      zeilen.push({ art: 'karte', card, zeilenKey: `${gruppe}::${card.folderId}` })
    }
  }
  return zeilen
}
