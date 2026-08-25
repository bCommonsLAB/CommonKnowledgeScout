/**
 * @fileoverview Gruppierung der Werkbank-Liste (F12/W5, umgebaut in A6) — pur.
 *
 * @description
 * Zweite Denk-Ebene neben der Ordnerstruktur (§11): die Liste gruppiert nach
 * **Bereich** (erstes Pfadsegment, W3-Verhalten unveraendert) oder nach
 * **Thema**. Seit A6 ist die einzige Quelle das VON HAND gepflegte Feld
 * `themen:` im `_INDEX.md` (`card.gepflegteThemen`) — die BERICHT-`themen`
 * (technische Bausteine) erzeugten fast nur Ein-Element-Gruppen und
 * fuehrten in die Irre (Stand 24.08.: 138 von 148 „Ohne Thema"). Ein
 * Vorhaben erscheint unter JEDEM seiner gepflegten Themen; ohne Themen —
 * auch bei Karten aus Scans vor A6 (`gepflegteThemen === undefined`) —
 * landet es in der benannten Gruppe „Ohne Thema", sichtbar statt still
 * verschluckt (Akzeptanzkriterium 10 gilt unveraendert).
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

/** Benannte Gruppe fuer Vorhaben ohne gepflegtes `thema:` — nie unsichtbar. */
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

/** Gruppen einer Karte — der Bereich, oder je gepflegtem Thema eine (A6). */
export function gruppenVon(card: VorhabenCard, gruppierung: WerkbankGruppierung): string[] {
  if (gruppierung === 'bereich') return [bereichVon(card)]
  if (card.gepflegteThemen === undefined || card.gepflegteThemen.length === 0) return [OHNE_THEMA_GRUPPE]
  return card.gepflegteThemen
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

/**
 * Themen-Vokabular der Library (A6): alle gepflegten Themen der Karten,
 * dedupliziert und alphabetisch — der Vorrat des Normalisierungs-Dropdowns.
 */
export function alleGepflegtenThemen(karten: readonly VorhabenCard[]): string[] {
  const themen = new Set<string>()
  for (const karte of karten) {
    for (const thema of karte.gepflegteThemen ?? []) themen.add(thema)
  }
  return [...themen].sort((a, b) => a.localeCompare(b))
}

/**
 * Ueberlagert frisch geschriebene Themen (Route-Erfolg) auf die Karten des
 * gespeicherten Reports — bis zum naechsten Scan, Muster Stand-Overrides.
 */
export function ueberlagereThemen(
  karten: readonly VorhabenCard[],
  overrides: ReadonlyMap<string, string[]>,
): VorhabenCard[] {
  if (overrides.size === 0) return [...karten]
  return karten.map((karte) => {
    const frisch = overrides.get(karte.folderId)
    return frisch === undefined ? karte : { ...karte, gepflegteThemen: frisch }
  })
}
