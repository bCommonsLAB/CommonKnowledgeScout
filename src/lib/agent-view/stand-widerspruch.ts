/**
 * @fileoverview `stand_widerspruch`: erklaerter Stand gegen berechneten Befund.
 *
 * @description
 * Die doppelte Buchhaltung als Regel (Erschliessungszyklus §4): Der
 * `bearbeitungsstand` ist eine BEHAUPTUNG (Soll-Buch). Widerlegt wird sie,
 * wenn seit `bearbeitungsstand_seit` etwas im Teilbaum geaendert wurde oder
 * offene Befunde im Teilbaum liegen, die zu einem BEREITS BEHAUPTETEN Schritt
 * gehoeren.
 *
 * Der Schritt entscheidet (Befund 24.08.2026): Ein Stand behauptet, die
 * Schritte bis zu seinem eigenen seien fertig — `berichtet` heisst „Schritt 3
 * erledigt, Schritt 4 steht aus". Ein Befund aus einem SPAETEREN Schritt
 * widerlegt diese Behauptung darum nicht, er beschreibt die noch offene
 * Arbeit. Konkret: die 28 `twin_unverified` (Schritt 4) sind unter
 * `berichtet` der ERWARTETE Zustand, nicht ein Widerspruch; unter
 * `abgenommen` (Schritt 4 behauptet) widerlegen sie sehr wohl.
 *
 * Die Sicht korrigiert dabei NIE eine Datei — sie zeigt den Widerspruch und
 * erzeugt das Todo (Leitprinzip 6). Mtime-basierte Rueckfall-Verdachte sind
 * ausdruecklich ein PRUEFAUFTRAG, kein Urteil: Sync-Werkzeuge koennen
 * Zeitstempel anfassen (F2). Deshalb steht der Grund im Befund.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import { isAtLeast, standRank } from './bearbeitungsstand'
import { GAP_REGISTRY, createGap, routeStandWiderspruch } from './gap-registry'
import type { Bearbeitungsstand, CoverageGap, CoverageGapType, CoverageTreeNode } from './types'

/** Ab diesem Stand gilt ein Vorhaben als „fertig behauptet". */
const CLAIMED_DONE = 'berichtet' as const

/**
 * Welchen Zyklus-Schritt ein Stand als erledigt BEHAUPTET. `ungesichtet`
 * behauptet nichts (0) — es wird ohnehin nie geprueft (siehe CLAIMED_DONE).
 * Die Reihenfolge ist die von `BEARBEITUNGSSTAND_VALUES`, also faellt der
 * Schritt mit `standRank` zusammen.
 */
function behaupteterSchritt(stand: Bearbeitungsstand): number {
  return standRank(stand)
}

/**
 * Befunde, die den behaupteten Stand widerlegen: alles bis einschliesslich
 * des behaupteten Schritts. Spaetere Schritte sind offene Arbeit, kein
 * Widerspruch. `stand_widerspruch` selbst zaehlt nie (sonst haelt er sich
 * selbst am Leben).
 */
export function widerlegendeTypen(
  typen: readonly CoverageGapType[],
  stand: Bearbeitungsstand,
): CoverageGapType[] {
  const grenze = behaupteterSchritt(stand)
  return typen.filter(
    (type) => type !== 'stand_widerspruch' && GAP_REGISTRY[type].zyklusSchritt <= grenze,
  )
}

export interface StandCheckArgs {
  node: CoverageTreeNode
  /** Juengste Aenderung im Teilbaum (Dateien + Twins) als ISO, null = unbekannt. */
  newestChangeInSubtree: string | null
  /** Befund-Typen im Teilbaum (fuer das Routing auf den Rueckfall-Schritt). */
  subtreeGapTypes: readonly CoverageGapType[]
}

/**
 * Prueft EIN Vorhaben. Liefert `null`, wenn der erklaerte Stand haelt.
 *
 * Nur Staende ab `berichtet` koennen widerlegt werden — davor ist „offene
 * Befunde im Teilbaum" der Normalzustand und kein Widerspruch.
 */
export function checkStandWiderspruch(args: StandCheckArgs): CoverageGap | null {
  const { node } = args
  if (!isAtLeast(node.bearbeitungsstand, CLAIMED_DONE)) return null

  const reasons: string[] = []

  if (node.bearbeitungsstandSeit !== null && args.newestChangeInSubtree !== null) {
    const seit = Date.parse(node.bearbeitungsstandSeit)
    const changed = Date.parse(args.newestChangeInSubtree)
    if (!Number.isNaN(seit) && !Number.isNaN(changed) && changed > seit) {
      reasons.push(
        `Aenderung ${args.newestChangeInSubtree} nach bearbeitungsstand_seit ${node.bearbeitungsstandSeit} (Pruefauftrag, kein Urteil — Sync-Werkzeuge koennen Zeitstempel anfassen)`,
      )
    }
  }

  const blockingTypes = widerlegendeTypen(args.subtreeGapTypes, node.bearbeitungsstand as Bearbeitungsstand)
  if (blockingTypes.length > 0) {
    const distinct = [...new Set(blockingTypes)].sort((a, b) => a.localeCompare(b))
    reasons.push(`offene Befunde im Teilbaum: ${distinct.join(', ')}`)
  }

  if (reasons.length === 0) return null

  const routing = routeStandWiderspruch(blockingTypes)
  return createGap({
    type: 'stand_widerspruch',
    scope: 'folder',
    targetId: node.folderId,
    targetName: node.name || '(Wurzel)',
    folderId: node.folderId,
    path: node.path,
    message: `Erklaerter Stand „${node.bearbeitungsstand}" ist durch Befunde widerlegt`,
    detail: reasons.join('; '),
    actorOverride: routing.actor,
    zyklusSchrittOverride: routing.zyklusSchritt,
  })
}
