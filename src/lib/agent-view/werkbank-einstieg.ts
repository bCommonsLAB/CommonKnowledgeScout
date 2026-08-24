/**
 * @fileoverview Zahlen des Werkbank-Einstiegs (Welle A1) — pur.
 *
 * @description
 * Der Leerzustand der Werkbank beantwortet die Frage „was muss ich tun?",
 * nicht „was liegt im Archiv?" (Projektauftrag Werkbank-Abnahme, A1). Die
 * betonte Zahl ist darum, wie viele VORHABEN jetzt auf den Menschen warten —
 * die Bestandszahlen folgen als Nebenzeile.
 *
 * „Wartet auf dich" ist kein neues Praedikat: es ist {@link
 * zaehleWorklistFortschritt}`.bereit`, also das geteilte
 * {@link istBereitZurAbnahme} MINUS der bereits abgenommenen Vorhaben —
 * dieselbe Definition wie Fortschrittskopf, Ampel und MCP-Kompaktsicht
 * (Projektauftrag §Regeln: geteilte Praedikate statt Kopien).
 *
 * Reine Funktion, kein I/O.
 *
 * @module agent-view
 */

import type { CoverageReport } from './types'
import { zaehleWorklistFortschritt } from './worklist-fortschritt'

export interface EinstiegZahlen {
  /** Vorhaben, die JETZT auf den Menschen warten (bereit und noch nicht abgenommen). */
  wartetAufDich: number
  /** Offene Befunde je Akteur — Library-weit, wie die frueheren Kopf-Chips. */
  mensch: number
  cowork: number
  knowledgescout: number
  /** Bestand des Archivs — beschreibt das Archiv, nicht die Arbeit (Nebenzeile). */
  bestand: { ordner: number; dateien: number; quellen: number; artefakte: number }
}

/** Die vier Karten + die Nebenzeile des Leerzustands aus dem gespeicherten Report. */
export function zaehleEinstieg(report: Pick<CoverageReport, 'vorhaben' | 'totals'>): EinstiegZahlen {
  const { totals } = report
  return {
    wartetAufDich: zaehleWorklistFortschritt(report.vorhaben).bereit,
    mensch: totals.gapsByActor.mensch,
    cowork: totals.gapsByActor.cowork,
    knowledgescout: totals.gapsByActor.knowledgescout,
    bestand: {
      ordner: totals.folders,
      dateien: totals.files,
      quellen: totals.sources,
      artefakte: totals.twins,
    },
  }
}
