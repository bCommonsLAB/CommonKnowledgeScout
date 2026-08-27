/**
 * @fileoverview Geteilte Praedikate rund um die Abnahme (D2, Werkbank W1).
 *
 * @description
 * EINE Definition fuer MCP-Kompaktsicht und UI (Projektauftrag v2 §7: geteilte
 * Praedikate, kein Drift).
 *
 * Seit ADR 0006 (Modell B) zaehlt nicht mehr, wie viel der Mensch bestaetigt
 * hat, sondern ob **Widerstand** vorliegt: maschinelle Befunde (Akteur
 * `cowork`/`knowledgescout`) und die vom Menschen gesetzte Fehler-Markierung
 * (`twin_flagged`). Fehlende menschliche Pruefung ist kein Widerstand mehr —
 * Maschinenarbeit gilt als angenommen.
 *
 * Abgrenzung F8/W7: Der Abnahme-PRECHECK der Stand-Route urteilt spaeter
 * strenger ueber einen frischen Teilbaum-Scan (nur Severity error/warning);
 * die Praedikate hier beschreiben den GESPEICHERTEN Report.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type {
  Bearbeitungsstand,
  CoverageGap,
  CoverageGapType,
  GapCountByActor,
  GapCountByType,
} from './types'

/** Zaehlt Befunde je Akteur (Form wie `CoverageTreeNode.gapsByActor`). */
export function zaehleGapsNachAkteur(gaps: readonly Pick<CoverageGap, 'actor'>[]): GapCountByActor {
  const counts: GapCountByActor = { mensch: 0, cowork: 0, knowledgescout: 0 }
  for (const gap of gaps) counts[gap.actor] += 1
  return counts
}

/** Zaehlt Befunde je Typ (Form wie `CoverageTreeNode.gapsByType`). */
export function zaehleGapsNachTyp(gaps: readonly Pick<CoverageGap, 'type'>[]): GapCountByType {
  const counts: GapCountByType = {}
  for (const gap of gaps) counts[gap.type] = (counts[gap.type] ?? 0) + 1
  return counts
}

/**
 * Befund-Typen mit Akteur `mensch`, die trotzdem sperren: Was der Mensch
 * ausdruecklich als falsch benannt hat, ist ein echter Widerstand (ADR 0006).
 * Die uebrigen Mensch-Befunde (z. B. `stand_widerspruch`) wollen
 * Aufmerksamkeit, sperren aber nichts — sie sind kein Tor.
 */
const MENSCHLICHE_WIDERSTAENDE: readonly CoverageGapType[] = ['twin_flagged']

/**
 * Offene Widerstaende: maschinelle Befunde + Fehler-Markierungen.
 * Null Widerstaende = es steht nichts im Weg.
 */
export function zaehleWiderstaende(byActor: GapCountByActor, byType: GapCountByType): number {
  const maschinell = byActor.cowork + byActor.knowledgescout
  const markiert = MENSCHLICHE_WIDERSTAENDE.reduce((summe, typ) => summe + (byType[typ] ?? 0), 0)
  return maschinell + markiert
}

/**
 * Darf der Mensch JETZT abnehmen? Bedingung: kein Widerstand offen.
 *
 * Bewusst OHNE „mindestens ein Mensch-Befund" (Befund 24.08.2026: sonst
 * sperrt sich der Knopf genau dann, wenn alles erledigt ist) und seit
 * ADR 0006 auch ohne jede Verifikations-Quote — ein befundfreies Vorhaben
 * ist der Zielzustand und muss beurkundbar sein.
 */
export function istAbnehmbar(byActor: GapCountByActor, byType: GapCountByType): boolean {
  return zaehleWiderstaende(byActor, byType) === 0
}

/** Karte, wie die Praedikate sie brauchen (VorhabenCard erfuellt das). */
export interface AbnahmeSicht {
  gapsByActor: GapCountByActor
  gapsByType: GapCountByType
  bearbeitungsstand: Bearbeitungsstand | null
  /** Der erklaerte Stand passt nicht zum Inhalt — dann wartet er wieder. */
  widerspruch?: boolean
}

/**
 * „Wartet auf deine Abnahme" (Filter „Bereit", Ampel-Gelb der Werkbank,
 * Fortschrittsbalken): kein Widerstand offen UND noch nicht abgenommen.
 *
 * Ersetzt das fruehere `istBereitZurAbnahme`, das mindestens einen offenen
 * Mensch-Befund verlangte. Mit dem Wegfall von `twin_unverified` (ADR 0006)
 * waere diese Bedingung fast nie erfuellt gewesen — die Bereit-Liste waere
 * leer geblieben.
 */
export function wartetAufAbnahme(karte: AbnahmeSicht): boolean {
  // Abgenommen heisst erledigt — ausser der Stand ist widerlegt, dann wartet
  // die Beurkundung erneut (Verhalten aus W1, unveraendert uebernommen).
  if (karte.bearbeitungsstand === 'abgenommen' && karte.widerspruch !== true) return false
  return istAbnehmbar(karte.gapsByActor, karte.gapsByType)
}
