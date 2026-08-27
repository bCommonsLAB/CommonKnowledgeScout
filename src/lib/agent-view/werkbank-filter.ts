/**
 * @fileoverview Werkbank-Liste (F6, Welle W3): Filter, Suche, Sortierung — pur.
 *
 * @description
 * Die geteilte Filter-Semantik der Werkbank (Projektauftrag v2 §7):
 *
 * - „Zu tun" = `ampel ≠ gruen` ODER `widerspruch` (Begriffsdefinition §3).
 *   Karten aus Scans vor W1 tragen keine `ampel` — sie sind NICHT auswertbar
 *   und werden sichtbar gezaehlt statt still einsortiert.
 * - „Bereit" = geteiltes Praedikat {@link wartetAufAbnahme} (W1, ADR 0006):
 *   kein Widerstand offen und noch nicht abgenommen.
 * - Akteur-/Schritt-Chips = EXAKT die Filter-Semantik der MCP-Kompaktsicht:
 *   {@link matchtBefundFilter} ist die gemeinsame Funktion, die MCP auf
 *   Befunde und die UI (ueber die `GAP_REGISTRY`) auf Karten anwendet.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import { wartetAufAbnahme } from './abnahme'
import { GAP_REGISTRY } from './gap-registry'
import { BOARD_COLUMNS } from './labels'
import type { CoverageGap, CoverageGapType, GapActor, VorhabenCard, ZyklusSchritt } from './types'

/** `liste` (W6, F7): nur Mitglieder der aktiven Arbeitsliste. */
export type WerkbankStatusFilter = 'alle' | 'zu_tun' | 'bereit' | 'liste'
export type WerkbankSortierung = 'pfad' | 'stand' | 'befunde'

/** Chip-Filter der UI — dieselbe Form wie die MCP-Argumente `akteur`/`zyklusSchritt`. */
export interface BefundFilter {
  akteur: GapActor | null
  zyklusSchritt: ZyklusSchritt | null
}

/**
 * Matcht ein Befund den Chip-Filter? EINE Definition fuer MCP und UI.
 * `zyklusSchritt` ist bewusst `number | null` — die MCP-Argumente kommen
 * unvalidiert als Zahl; ein Wert ausserhalb 1–4 matcht schlicht nichts
 * (identisch zum bisherigen MCP-Verhalten).
 */
export function matchtBefundFilter(
  befund: Pick<CoverageGap, 'actor' | 'zyklusSchritt'>,
  filter: { akteur: GapActor | null; zyklusSchritt: number | null },
): boolean {
  return (
    (filter.akteur === null || befund.actor === filter.akteur) &&
    (filter.zyklusSchritt === null || befund.zyklusSchritt === filter.zyklusSchritt)
  )
}

/**
 * „Zu tun" nach §3; `null` = Karte aus einem Scan vor W1 (keine `ampel`) —
 * der Aufrufer zaehlt das sichtbar, statt zu raten (`no-silent-fallbacks`).
 */
export function zuTun(card: VorhabenCard): boolean | null {
  if (card.ampel === undefined) return null
  return card.ampel !== 'gruen' || card.widerspruch
}

/**
 * Hat die Karte mindestens einen Befund, der den Chip-Filter matcht?
 * Gerechnet aus `gapsByType` + `GAP_REGISTRY` (Typ → Akteur/Schritt ist
 * deterministisch) — exakt, ohne die Befundliste zu brauchen.
 */
export function karteHatBefundZu(card: VorhabenCard, filter: BefundFilter): boolean {
  if (filter.akteur === null && filter.zyklusSchritt === null) return true
  for (const [type, count] of Object.entries(card.gapsByType)) {
    if (!count) continue
    const def = GAP_REGISTRY[type as CoverageGapType]
    // Kein default-Zweig, in dem neue Typen verschwinden: unbekannt = laut.
    if (def === undefined) throw new Error(`Unbekannter Gap-Typ im Report: ${type}`)
    if (matchtBefundFilter({ actor: def.actor, zyklusSchritt: def.zyklusSchritt }, filter)) return true
  }
  return false
}

/** Bereich einer Karte = erstes Pfadsegment (Gruppenkoepfe der Liste, F6). */
export function bereichVon(card: VorhabenCard): string {
  const [erstes] = card.path.split('/')
  return erstes || card.name
}

function sucheMatcht(card: VorhabenCard, sucheKlein: string): boolean {
  if (card.name.toLowerCase().includes(sucheKlein)) return true
  if (card.path.toLowerCase().includes(sucheKlein)) return true
  return typeof card.berichtTitel === 'string' && card.berichtTitel.toLowerCase().includes(sucheKlein)
}

export interface WerkbankFilterArgs {
  statusFilter: WerkbankStatusFilter
  befundFilter: BefundFilter
  /** Suchtext ueber Name + Pfad + Bericht-Titel; leer = keine Suche. */
  suche: string
  /**
   * folderIds der aktiven Arbeitsliste (W6) — Pflicht bei `statusFilter:
   * 'liste'`; `null` heisst „keine Liste gewaehlt" und ergibt eine BENANNT
   * leere Liste, kein stilles Alles.
   */
  listenMitglieder?: ReadonlySet<string> | null
}

export interface WerkbankFilterErgebnis {
  zeilen: VorhabenCard[]
  /**
   * Karten aus Scans vor W1, die Suche/Chips passierten, deren „Zu tun" aber
   * nicht auswertbar ist — sichtbar gezaehlt, nie still weggefiltert.
   */
  nichtAuswertbar: number
}

/** Wendet Status-Filter, Chips und Suche an (Reihenfolge: Suche → Chips → Status). */
export function filtereVorhaben(
  cards: readonly VorhabenCard[],
  args: WerkbankFilterArgs,
): WerkbankFilterErgebnis {
  const sucheKlein = args.suche.trim().toLowerCase()
  const zeilen: VorhabenCard[] = []
  let nichtAuswertbar = 0
  const mitglieder = args.listenMitglieder ?? null
  for (const card of cards) {
    if (sucheKlein !== '' && !sucheMatcht(card, sucheKlein)) continue
    if (!karteHatBefundZu(card, args.befundFilter)) continue
    if (args.statusFilter === 'zu_tun') {
      const status = zuTun(card)
      if (status === null) {
        nichtAuswertbar += 1
        continue
      }
      if (!status) continue
    } else if (args.statusFilter === 'bereit') {
      if (!wartetAufAbnahme(card)) continue
    } else if (args.statusFilter === 'liste') {
      if (mitglieder === null || !mitglieder.has(card.folderId)) continue
    }
    zeilen.push(card)
  }
  return { zeilen, nichtAuswertbar }
}

/**
 * Bereich AUFSTEIGEND, darin der Vorhabens-Pfad ABSTEIGEND.
 *
 * Die Vorhabensordner sind mit Jahr/Monat benannt (`26.01 Klimamassnahmen
 * …`), darum heisst absteigend: NEUESTE ZUERST (Befund Testsession
 * 25.08.2026). Der Bereich bleibt aufsteigend — sonst stuenden die Phasen
 * 7…1 verkehrt herum, was niemand verlangt hat.
 */
function vergleichePfad(a: VorhabenCard, b: VorhabenCard): number {
  return bereichVon(a).localeCompare(bereichVon(b)) || b.path.localeCompare(a.path)
}

/**
 * Sortiert deterministisch (Sekundaerschluessel immer {@link vergleichePfad}):
 * `pfad` = Bereich aufsteigend, darin neueste zuerst · `stand` =
 * Zyklus-Reihenfolge der Board-Spalten (ohne erklaerten Stand zuletzt) ·
 * `befunde` = offene Befunde absteigend.
 */
export function sortiereVorhaben(
  cards: readonly VorhabenCard[],
  sortierung: WerkbankSortierung,
): VorhabenCard[] {
  const sorted = [...cards]
  if (sortierung === 'pfad') return sorted.sort(vergleichePfad)
  if (sortierung === 'stand') {
    return sorted.sort(
      (a, b) =>
        BOARD_COLUMNS.indexOf(a.bearbeitungsstand) - BOARD_COLUMNS.indexOf(b.bearbeitungsstand) ||
        vergleichePfad(a, b),
    )
  }
  return sorted.sort((a, b) => b.totalGaps - a.totalGaps || vergleichePfad(a, b))
}
