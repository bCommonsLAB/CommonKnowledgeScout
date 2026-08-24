/**
 * @fileoverview Umbau-Helfer des Teilbaum-Merges (F10, Welle W8).
 *
 * @description
 * Reine Transformationen fuer `report-merge.ts`: Teil-Report-Pfade sind
 * SCOPE-relativ (Scan-Wurzel = '') — „heben" heisst, sie auf die
 * Library-Pfade des Voll-Reports zu praefixieren. Dazu die Wiederaufbauten,
 * die beide Seiten gleich behandeln: Karten werden einheitlich am gemergten
 * Baum aufgefrischt (Aggregate stammen IMMER aus dem Baum, Bericht-Skalare
 * aus dem jeweiligen Quell-Report), Familien pfadsortiert und an derselben
 * Kappe gekappt wie `buildFamilySummaries`, Totale ueber das geteilte
 * `tally` gezaehlt. Kein I/O.
 *
 * @module agent-view
 */

import { tally } from './coverage-totals'
import { MAX_FAMILY_SUMMARIES } from './family-summaries'
import type {
  CoverageGap,
  CoverageTotals,
  CoverageTreeNode,
  TwinFamilySummary,
  VorhabenCard,
} from './types'

/** Scope-relativen Pfad auf den Library-Pfad heben ('' = die Scope-Wurzel selbst). */
export function praefixiere(path: string, prefix: string): string {
  if (prefix === '') return path
  return path === '' ? prefix : `${prefix}/${path}`
}

/**
 * Hebt den Teil-Baum auf Library-Pfade. Die Scan-Wurzel des Teil-Reports
 * traegt Name '' und Tiefe 0 — Name, Pfad und Tiefe erbt sie vom Knoten des
 * Voll-Reports; alle frischen Inhalte (Stand, Zaehler, Skalare) bleiben.
 */
export function hebeTeilbaum(teilRoot: CoverageTreeNode, scopeNode: CoverageTreeNode): CoverageTreeNode {
  const hebe = (node: CoverageTreeNode, path: string, depth: number, name: string): CoverageTreeNode => ({
    ...node,
    name,
    path,
    depth,
    children: node.children.map((child) =>
      hebe(child, praefixiere(child.path, scopeNode.path), scopeNode.depth + child.depth, child.name),
    ),
  })
  return hebe(teilRoot, scopeNode.path, scopeNode.depth, scopeNode.name)
}

/**
 * Hebt Teil-Befunde auf Library-Pfade. Befunde, die die Scan-Wurzel SELBST
 * meinen, tragen im Teil-Report den Platzhalter-Namen „(Wurzel)" — sie
 * bekommen den echten Ordnernamen, wie ihn der Voll-Scan schreiben wuerde.
 */
export function hebeGaps(
  gaps: readonly CoverageGap[],
  scopeFolderId: string,
  scopeNode: CoverageTreeNode,
): CoverageGap[] {
  return gaps.map((gap) => ({
    ...gap,
    path: praefixiere(gap.path, scopeNode.path),
    targetName:
      gap.targetId === scopeFolderId && gap.targetName === '(Wurzel)'
        ? scopeNode.name || '(Wurzel)'
        : gap.targetName,
  }))
}

export function hebeKarten(cards: readonly VorhabenCard[], scopeNode: CoverageTreeNode): VorhabenCard[] {
  return cards.map((card) => ({ ...card, path: praefixiere(card.path, scopeNode.path) }))
}

export function hebeFamilien(
  families: readonly TwinFamilySummary[],
  scopeNode: CoverageTreeNode,
): TwinFamilySummary[] {
  return families.map((family) => ({ ...family, path: praefixiere(family.path, scopeNode.path) }))
}

function flatten(nodes: readonly CoverageTreeNode[], into: Map<string, CoverageTreeNode>): void {
  for (const node of nodes) {
    into.set(node.folderId, node)
    flatten(node.children, into)
  }
}

/**
 * Frischt ALLE Karten einheitlich am gemergten Baum auf: Aggregate, Ampel und
 * Widerspruch kommen aus Baum + Befunden (dieselbe Quelle wie beim Voll-Scan,
 * `buildVorhabenCards`); die Bericht-Skalare und `themen` behaelt jede Karte
 * aus ihrem Quell-Report (aussen: alter Voll-Report, innen: frischer Teil-Scan).
 */
export function baueMergeKarten(args: {
  karten: readonly VorhabenCard[]
  tree: readonly CoverageTreeNode[]
  gaps: readonly CoverageGap[]
}): VorhabenCard[] {
  const nodes = new Map<string, CoverageTreeNode>()
  flatten(args.tree, nodes)
  const widerspruch = new Set(
    args.gaps.filter((gap) => gap.type === 'stand_widerspruch').map((gap) => gap.folderId),
  )
  return args.karten
    .map((card) => {
      const node = nodes.get(card.folderId)
      if (!node) throw new Error(`Vorhaben ohne Baumknoten nach Merge: ${card.folderId}`)
      return {
        ...card,
        name: node.name || '(Wurzel)',
        path: node.path,
        bearbeitungsstand: node.bearbeitungsstand,
        bearbeitungsstandSeit: node.bearbeitungsstandSeit,
        hasBericht: node.hasBericht,
        totalGaps: node.totalGaps,
        gapsByActor: { ...node.gapsByActor },
        gapsByType: { ...node.gapsByType },
        widerspruch: widerspruch.has(card.folderId),
        ampel: node.ampel,
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}

/** Familien beider Seiten: pfadsortiert und an DERSELBEN Kappe wie der Voll-Scan. */
export function baueMergeFamilien(
  families: readonly TwinFamilySummary[],
): { families: TwinFamilySummary[]; truncated: boolean } {
  const sortiert = [...families].sort((a, b) => a.path.localeCompare(b.path))
  const truncated = sortiert.length > MAX_FAMILY_SUMMARIES
  return { families: truncated ? sortiert.slice(0, MAX_FAMILY_SUMMARIES) : sortiert, truncated }
}

/**
 * Totale aus Baum + Befunden + Familien — dieselben Groessen wie
 * `buildTotals`, nur aus dem Merge-Ergebnis gerechnet. Die Ausschluss-Zaehler
 * sind Library-weite BETRIEBSzaehler des Scans und aus zwei Reports nicht
 * exakt zerlegbar: sie bleiben vom Voll-Report (naechster Voll-Scan
 * normalisiert; sichtbar dokumentiert statt still geraten).
 */
export function baueMergeTotals(args: {
  tree: readonly CoverageTreeNode[]
  gaps: readonly CoverageGap[]
  families: readonly TwinFamilySummary[]
  skippedExcluded: CoverageTotals['skippedExcluded']
}): CoverageTotals {
  const nodes = new Map<string, CoverageTreeNode>()
  flatten(args.tree, nodes)
  let files = 0
  for (const node of nodes.values()) files += node.fileCount
  const { byType, byActor } = tally(args.gaps)
  let collapsedGaps = 0
  for (const gap of args.gaps) {
    if (gap.type !== 'teilbaum_ungesichtet') continue
    if (typeof gap.anzahl !== 'number') {
      throw new Error(`Sammel-Gap ohne anzahl-Feld (${gap.folderId}) — Report vor W8 haette den Merge-Guard ausloesen muessen`)
    }
    collapsedGaps += gap.anzahl
  }
  return {
    folders: nodes.size,
    files,
    sources: args.families.length,
    twins: args.families.reduce((sum, family) => sum + family.artifactCount, 0),
    gaps: args.gaps.length,
    gapsByType: byType,
    gapsByActor: byActor,
    skippedExcluded: { ...args.skippedExcluded },
    collapsedGaps,
    scanErrors: args.gaps.filter((gap) => gap.type === 'scan_error').length,
  }
}
