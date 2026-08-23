/**
 * @fileoverview Teilbaum-Helfer der Agentensicht (Werkbank W4).
 *
 * @description
 * EINE Pfad-Teilbaum-Definition fuer MCP und UI: `isInSubtree` wohnte in
 * `mcp/coverage-view.ts` und ist mit W4 hierher gezogen (§7 geteilte
 * Funktionen; die MCP-Sicht re-exportiert sie). Dazu die reine
 * Datenaufbereitung des Werkbank-Details: Knoten finden, Teilbaum-Zaehler,
 * Befunde/Familien des Teilbaums, Bericht-Frische. Kein I/O.
 *
 * @module agent-view
 */

import type { CoverageGap, CoverageTreeNode, TwinFamilySummary } from './types'

/** Liegt `path` im Teilbaum von `prefix`? Leerer Prefix matcht alles. */
export function isInSubtree(path: string, prefix: string): boolean {
  if (prefix === '') return true
  return path === prefix || path.startsWith(`${prefix}/`)
}

/** Findet den Baumknoten zur folderId; null = nicht im Report. */
export function findeKnoten(
  nodes: readonly CoverageTreeNode[],
  folderId: string,
): CoverageTreeNode | null {
  for (const node of nodes) {
    if (node.folderId === folderId) return node
    const inChildren = findeKnoten(node.children, folderId)
    if (inChildren !== null) return inChildren
  }
  return null
}

/** Quellen-/Dateizaehler ueber den GESAMTEN Teilbaum eines Knotens (Fusszeile F9). */
export function teilbaumZaehler(node: CoverageTreeNode): { quellen: number; dateien: number } {
  let quellen = node.sourceCount
  let dateien = node.fileCount
  for (const child of node.children) {
    const unten = teilbaumZaehler(child)
    quellen += unten.quellen
    dateien += unten.dateien
  }
  return { quellen, dateien }
}

/** Befunde des Teilbaums eines Vorhabens (Pfade sind report-relativ wie `karte.path`). */
export function teilbaumBefunde(
  gaps: readonly CoverageGap[],
  vorhabenPath: string,
): CoverageGap[] {
  return gaps.filter((gap) => isInSubtree(gap.path, vorhabenPath))
}

/** Twin-Familien des Teilbaums; undefined = Report aus einem Scan vor Welle 4 (benennen!). */
export function familienImTeilbaum(
  families: readonly TwinFamilySummary[] | undefined,
  vorhabenPath: string,
): TwinFamilySummary[] | undefined {
  if (families === undefined) return undefined
  return families.filter((family) => isInSubtree(family.path, vorhabenPath))
}

/**
 * Ist der BERICHT.md DIESES Vorhabens veraltet? Zaehlt nur der Befund am
 * Vorhabensordner selbst (`folderId`), nicht veraltete Berichte von
 * Unter-Vorhaben im Teilbaum.
 */
export function istBerichtVeraltet(gaps: readonly CoverageGap[], folderId: string): boolean {
  return gaps.some((gap) => gap.type === 'bericht_veraltet' && gap.folderId === folderId)
}
