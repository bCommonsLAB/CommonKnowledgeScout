/**
 * @fileoverview Arbeitslisten-Sicht auf den Report (F7, Welle W6) — pur.
 *
 * @description
 * Kreuzt Buch 3 (Listenmitglieder, folderId-Schluessel) mit Buch 2 (dem
 * wegwerfbaren Report): Fortschrittskopf „n von m abgenommen · k bereit zur
 * Abnahme · offene Befunde M/C/K" — REIN clientseitig gerechnet, keine
 * Server-Aggregation (F7). Mitglieder, die der letzte Scan nicht enthaelt,
 * sind TOTE Eintraege: angezeigt mit gemerktem `pathSnapshot`, nie still
 * verworfen. Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import { istBereitZurAbnahme } from './abnahme'
import type { GapCountByActor, VorhabenCard } from './types'

/** Minimale Mitglieds-Form (strukturkompatibel zum Repo-`WorklistFolderEntry`). */
export interface WorklistMitglied {
  folderId: string
  pathSnapshot: string
  name: string
}

export interface WorklistKreuzung {
  /** Mitglieder, die der Report kennt — in Listen-Reihenfolge. */
  karten: VorhabenCard[]
  /** Mitglieder ohne Karte im letzten Scan (geloescht, verschoben, Teilbaum-Report). */
  tote: WorklistMitglied[]
}

/** Kreuzt Mitglieder mit den Report-Karten; tote Eintraege bleiben sichtbar. */
export function kreuzeListeMitReport(
  mitglieder: readonly WorklistMitglied[],
  vorhaben: readonly VorhabenCard[],
): WorklistKreuzung {
  const karteNachId = new Map(vorhaben.map((karte) => [karte.folderId, karte]))
  const karten: VorhabenCard[] = []
  const tote: WorklistMitglied[] = []
  for (const mitglied of mitglieder) {
    const karte = karteNachId.get(mitglied.folderId)
    if (karte) karten.push(karte)
    else tote.push(mitglied)
  }
  return { karten, tote }
}

export interface WorklistFortschritt {
  gesamt: number
  /** Abgenommen OHNE Widerspruch — zaehlt als fertig (F7). */
  fertig: number
  /** Geteiltes Praedikat „bereit zur Abnahme" (und nicht schon fertig). */
  bereit: number
  /** Weder fertig noch bereit. */
  offen: number
  offeneBefunde: GapCountByActor
}

/** Fortschritt der Listen-Karten (Balken: fertig → bereit → offen). */
export function zaehleWorklistFortschritt(karten: readonly VorhabenCard[]): WorklistFortschritt {
  let fertig = 0
  let bereit = 0
  const offeneBefunde: GapCountByActor = { mensch: 0, cowork: 0, knowledgescout: 0 }
  for (const karte of karten) {
    if (karte.bearbeitungsstand === 'abgenommen' && !karte.widerspruch) fertig += 1
    else if (istBereitZurAbnahme(karte.gapsByActor)) bereit += 1
    offeneBefunde.mensch += karte.gapsByActor.mensch
    offeneBefunde.cowork += karte.gapsByActor.cowork
    offeneBefunde.knowledgescout += karte.gapsByActor.knowledgescout
  }
  return { gesamt: karten.length, fertig, bereit, offen: karten.length - fertig - bereit, offeneBefunde }
}
