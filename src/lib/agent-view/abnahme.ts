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
 * Abgrenzung zu {@link istAbnehmbar} (Befund 24.08.2026): „bereit" beschreibt
 * einen ZUSTAND — es wartet Arbeit auf den Menschen. Ob der Abnehmen-Knopf
 * gehen DARF, ist eine andere Frage: Wer seine Punkte gerade abgearbeitet hat,
 * muss abnehmen koennen, obwohl dann nichts mehr wartet.
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

/**
 * Darf der Mensch JETZT abnehmen? Einzige Bedingung: keine maschinellen
 * Befunde offen. Bewusst OHNE `mensch > 0` — sonst sperrt sich der Knopf
 * genau dann, wenn der Mensch seine Punkte gerade erledigt hat (Befund
 * 24.08.2026: 28 Twins verifiziert ⇒ „es gibt nichts abzunehmen"). Ein
 * befundfreies Vorhaben ist der Zielzustand und muss beurkundbar sein.
 *
 * Die Ampel und der Filter „Bereit" bleiben bei {@link istBereitZurAbnahme} —
 * sie beschreiben, wo ARBEIT wartet, nicht wo ein Knopf gehen darf.
 */
export function istAbnehmbar(byActor: GapCountByActor): boolean {
  return byActor.cowork + byActor.knowledgescout === 0
}
