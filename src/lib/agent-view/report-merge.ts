/**
 * @fileoverview Teilbaum-Merge (F10, Welle W8): Teil-Scan in den Voll-Report.
 *
 * @description
 * Ersetzt im gespeicherten VOLL-Report nur die Knoten, Befunde, Familien und
 * Karten des gescannten Teilbaums und rechnet alles Abgeleitete neu — mit den
 * ORIGINAL-Maschinen des Voll-Scans (`aggregiereZaehler`, `berichtVeraltetGap`,
 * `checkStandWiderspruch`, `tally`, `sortGaps`): ein Urteil, kein Drift.
 * Die beiden teilbaum-uebergreifenden Regeln (`stand_widerspruch`,
 * `bericht_veraltet`) werden fuer ALLE Knoten neu gefaellt — moeglich durch
 * die W8-Knoten-Skalare (eigene Aenderung, Bericht-Frische); Knoten unter
 * Kollaps-Wurzeln (Gap-Budget) sind ausgenommen, ihr Beitrag steckt in den
 * unveraenderten Sammel-Zaehlern. Voraussetzungen + benannte Fallbacks:
 * `report-merge-guards.ts`; Umbau-Helfer: `report-merge-umbau.ts`.
 *
 * Bekannte, dokumentierte Grenzen des Teilbaum-Scans selbst (heute schon so,
 * der Merge aendert daran nichts): das Verweis-Audit loest ueber die
 * Scope-Grenze in BEIDE Richtungen erst der naechste Voll-Scan sauber auf;
 * Familien, deren Ankerordner im Scope verschwand, wandern erst dann an die
 * Wurzel. Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import { berichtVeraltetGap } from './archive-rules'
import { newest } from './coverage-inputs'
import { sortGaps } from './gap-registry'
import { checkStandWiderspruch } from './stand-widerspruch'
import { isInSubtree } from './teilbaum'
import { aggregiereZaehler } from './tree-builder'
import { pruefeMergeVoraussetzungen, type MergeErgebnis } from './report-merge-guards'
import {
  baueMergeFamilien,
  baueMergeKarten,
  baueMergeTotals,
  hebeFamilien,
  hebeGaps,
  hebeKarten,
  hebeTeilbaum,
} from './report-merge-umbau'
import type { CoverageGap, CoverageGapType, CoverageReport, CoverageTreeNode } from './types'

export type { MergeErgebnis, MergeFallbackGrund } from './report-merge-guards'

function sammleFolderIds(node: CoverageTreeNode, into: Set<string>): void {
  into.add(node.folderId)
  for (const child of node.children) sammleFolderIds(child, into)
}

function ersetzeKnoten(nodes: CoverageTreeNode[], folderId: string, ersatz: CoverageTreeNode): boolean {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].folderId === folderId) {
      nodes[i] = ersatz
      return true
    }
    if (ersetzeKnoten(nodes[i].children, folderId, ersatz)) return true
  }
  return false
}

/** Teilbaum-Maxima der juengsten Aenderung aus den W8-Knoten-Skalaren (bottom-up). */
function teilbaumMaxima(roots: readonly CoverageTreeNode[]): Map<string, string | null> {
  const result = new Map<string, string | null>()
  const walk = (node: CoverageTreeNode): string | null => {
    let value = node.neuesteEigeneAenderung ?? null
    for (const child of node.children) value = newest(value, walk(child))
    result.set(node.folderId, value)
    return value
  }
  for (const root of roots) walk(root)
  return result
}

/** Beide teilbaum-uebergreifenden Regeln fuer ALLE Knoten neu faellen. */
function querschnittsRegeln(args: {
  roots: readonly CoverageTreeNode[]
  basisGaps: readonly CoverageGap[]
  berichtFreshness: boolean
}): CoverageGap[] {
  const maxima = teilbaumMaxima(args.roots)

  const berichtGaps: CoverageGap[] = []
  const sammleBericht = (node: CoverageTreeNode, unterKollaps: boolean): void => {
    const kollabiert = unterKollaps || node.bearbeitungsstand === 'ungesichtet'
    if (!kollabiert && typeof node.berichtFileId === 'string') {
      const gap = berichtVeraltetGap({
        folderId: node.folderId,
        path: node.path,
        berichtFileId: node.berichtFileId,
        berichtModifiedAt: node.berichtModifiedAt ?? null,
        newestChangeInSubtree: maxima.get(node.folderId) ?? null,
        berichtFreshness: args.berichtFreshness,
      })
      if (gap) berichtGaps.push(gap)
    }
    node.children.forEach((child) => sammleBericht(child, kollabiert))
  }
  args.roots.forEach((root) => sammleBericht(root, false))

  // Wie im Voll-Scan urteilt der Stand-Widerspruch ueber den ERSTEN Durchgang
  // (Basis + Bericht-Frische), nie ueber sich selbst.
  aggregiereZaehler(args.roots, [...args.basisGaps, ...berichtGaps])
  const standGaps: CoverageGap[] = []
  const sammleStand = (node: CoverageTreeNode): void => {
    const gap = checkStandWiderspruch({
      node,
      newestChangeInSubtree: maxima.get(node.folderId) ?? null,
      subtreeGapTypes: Object.keys(node.gapsByType) as CoverageGapType[],
    })
    if (gap) standGaps.push(gap)
    node.children.forEach(sammleStand)
  }
  args.roots.forEach(sammleStand)

  return [...berichtGaps, ...standGaps]
}

const QUERSCHNITT: ReadonlySet<CoverageGapType> = new Set(['stand_widerspruch', 'bericht_veraltet'])

/**
 * Merged einen Teil-Report in den gespeicherten Voll-Report. Ziel und
 * Testkriterium (§F10): das Ergebnis ist von einem Voll-Scan desselben
 * Zustands ununterscheidbar — bewiesen im Invarianz-Test.
 */
export function mergeTeilbaumReport(args: { voll: CoverageReport; teil: CoverageReport }): MergeErgebnis {
  const { voll, teil } = args
  const scopeFolderId = teil.scope.folderId
  if (scopeFolderId === null || scopeFolderId === undefined) {
    throw new Error('mergeTeilbaumReport verlangt einen Teil-Report (scope.folderId gesetzt)')
  }
  const voraussetzung = pruefeMergeVoraussetzungen({ voll, teil, scopeFolderId })
  if (!voraussetzung.ok) return voraussetzung.ergebnis
  const scopeNode = voraussetzung.scopeNode

  const alteScopeIds = new Set<string>()
  sammleFolderIds(scopeNode, alteScopeIds)
  const prefix = scopeNode.path
  const drinnen = (folderId: string, path: string): boolean =>
    alteScopeIds.has(folderId) || isInSubtree(path, prefix)

  if (teil.tree.length !== 1) throw new Error('Teil-Report ohne eindeutige Scan-Wurzel')
  const tree = structuredClone(voll.tree) as CoverageTreeNode[]
  const gehoben = hebeTeilbaum(structuredClone(teil.tree[0]) as CoverageTreeNode, scopeNode)
  if (!ersetzeKnoten(tree, scopeFolderId, gehoben)) {
    throw new Error(`Scope-Knoten beim Graft nicht gefunden: ${scopeFolderId}`)
  }

  const basisGaps = [
    ...voll.gaps.filter((gap) => !drinnen(gap.folderId, gap.path) && !QUERSCHNITT.has(gap.type)),
    ...hebeGaps(teil.gaps, scopeFolderId, scopeNode).filter((gap) => !QUERSCHNITT.has(gap.type)),
  ]
  const quer = querschnittsRegeln({ roots: tree, basisGaps, berichtFreshness: voll.conventions.berichtFreshness })
  const gaps = sortGaps([...basisGaps, ...quer])
  aggregiereZaehler(tree, gaps)

  const familien = baueMergeFamilien([
    ...(voll.families ?? []).filter((family) => !drinnen(family.folderId, family.path)),
    ...hebeFamilien(teil.families ?? [], scopeNode),
  ])
  const karten = baueMergeKarten({
    karten: [
      ...(voll.vorhaben ?? []).filter((card) => !drinnen(card.folderId, card.path)),
      ...hebeKarten(teil.vorhaben ?? [], scopeNode),
    ],
    tree,
    gaps,
  })

  return {
    merged: true,
    report: {
      libraryId: voll.libraryId,
      generatedAt: teil.generatedAt,
      derived: true,
      scope: { folderId: null, path: null },
      conventions: voll.conventions,
      totals: baueMergeTotals({ tree, gaps, families: familien.families, skippedExcluded: voll.totals.skippedExcluded }),
      gaps,
      tree,
      vorhaben: karten,
      families: familien.families,
      familiesTruncated: familien.truncated,
    },
  }
}
