/**
 * @fileoverview `stand_widerspruch`: erklaerter Stand gegen berechneten Befund.
 *
 * @description
 * Die doppelte Buchhaltung als Regel (Erschliessungszyklus §4): Der
 * `bearbeitungsstand` ist eine BEHAUPTUNG (Soll-Buch). Widerlegt wird sie,
 * wenn seit `bearbeitungsstand_seit` etwas im Teilbaum geaendert wurde oder
 * offene Befunde im Teilbaum liegen.
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

import { isAtLeast } from './bearbeitungsstand'
import { createGap, routeStandWiderspruch } from './gap-registry'
import type { CoverageGap, CoverageGapType, CoverageTreeNode } from './types'

/** Ab diesem Stand gilt ein Vorhaben als „fertig behauptet". */
const CLAIMED_DONE = 'berichtet' as const

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

  const blockingTypes = args.subtreeGapTypes.filter((type) => type !== 'stand_widerspruch')
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
