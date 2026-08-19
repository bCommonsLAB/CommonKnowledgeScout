/**
 * @fileoverview Zyklus-Board (F1b): Soll/Ist je Vorhaben als Kartenliste.
 *
 * @description
 * Zweite Darstellung neben dem Baum: alle Vorhaben nach `bearbeitungsstand`.
 * Jede Karte zeigt den ERKLAERTEN Stand (Soll-Buch) und den BERECHNETEN
 * Befund (Ist-Buch) — inklusive Widerspruchszustand („abgenommen, aber nicht
 * mehr aktuell"), ohne dass eine Datei angefasst wird.
 *
 * Reine Funktion, kein I/O.
 *
 * @module agent-view
 */

import type { ArchiveFolderNode } from './archive-types'
import { isVorhaben } from './archive-rules'
import type { CoverageGap, CoverageTreeNode, VorhabenCard } from './types'

function flatten(nodes: readonly CoverageTreeNode[], into: Map<string, CoverageTreeNode>): void {
  for (const node of nodes) {
    into.set(node.folderId, node)
    flatten(node.children, into)
  }
}

/** Baut die Karten des Zyklus-Boards aus Baum + Ordnerliste. */
export function buildVorhabenCards(args: {
  folders: readonly ArchiveFolderNode[]
  tree: readonly CoverageTreeNode[]
  gaps: readonly CoverageGap[]
  vorhabenPattern: RegExp | null
  /**
   * Ordner-Id der BIBLIOTHEKS-Wurzel (null bei Teilbaum-Scans). Die Wurzel
   * ist kein Vorhaben (Entscheid 2026-08-19: sie braucht keinen BERICHT) —
   * ihre Karte wuerde nur alle Befunde der Library doppeln.
   */
  libraryRootFolderId: string | null
}): VorhabenCard[] {
  const nodes = new Map<string, CoverageTreeNode>()
  flatten(args.tree, nodes)
  const widerspruch = new Set(
    args.gaps.filter((gap) => gap.type === 'stand_widerspruch').map((gap) => gap.folderId),
  )

  const cards: VorhabenCard[] = []
  for (const folder of args.folders) {
    if (folder.folderId === args.libraryRootFolderId) continue
    if (!isVorhaben(folder, args.vorhabenPattern)) continue
    const node = nodes.get(folder.folderId)
    if (!node) throw new Error(`Vorhaben ohne Baumknoten: ${folder.folderId}`)
    cards.push({
      folderId: node.folderId,
      name: node.name || '(Wurzel)',
      path: node.path,
      bearbeitungsstand: node.bearbeitungsstand,
      bearbeitungsstandSeit: node.bearbeitungsstandSeit,
      hasBericht: node.hasBericht,
      totalGaps: node.totalGaps,
      gapsByActor: { ...node.gapsByActor },
      gapsByType: { ...node.gapsByType },
      widerspruch: widerspruch.has(node.folderId),
    })
  }

  return cards.sort((a, b) => a.path.localeCompare(b.path))
}
