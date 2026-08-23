/**
 * @fileoverview Geteiltes Praedikat „bereit zur Abnahme" (D2, Werkbank W1).
 *
 * @description
 * EINE Definition fuer MCP-Kompaktsicht und UI (Projektauftrag v2 §7: geteilte
 * Praedikate, kein Drift): „bereit zur Abnahme" heisst NULL maschinelle
 * Befunde (Akteur `cowork`/`knowledgescout`) und mindestens ein Befund, der
 * auf den Menschen wartet (F4). Gruen kann nur der Mensch machen; ein leerer
 * Scope ist NICHT „bereit" — dort gibt es nichts abzunehmen.
 *
 * Abgrenzung F8/W7: Der Abnahme-PRECHECK der Stand-Route urteilt spaeter
 * strenger ueber einen frischen Teilbaum-Scan (nur Severity error/warning);
 * dieses Praedikat beschreibt den GESPEICHERTEN Report.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { CoverageGap, GapCountByActor } from './types'

/** Zaehlt Befunde je Akteur (Form wie `CoverageTreeNode.gapsByActor`). */
export function zaehleGapsNachAkteur(gaps: readonly Pick<CoverageGap, 'actor'>[]): GapCountByActor {
  const counts: GapCountByActor = { mensch: 0, cowork: 0, knowledgescout: 0 }
  for (const gap of gaps) counts[gap.actor] += 1
  return counts
}

/**
 * D2: null maschinelle Befunde, mindestens einer wartet auf den Menschen.
 * Funktioniert auf jedem `gapsByActor` — Library-Totale, Baumknoten oder
 * `VorhabenCard` (W3/W7 nutzen dieselbe Funktion je Vorhaben).
 */
export function istBereitZurAbnahme(byActor: GapCountByActor): boolean {
  return byActor.cowork + byActor.knowledgescout === 0 && byActor.mensch > 0
}
