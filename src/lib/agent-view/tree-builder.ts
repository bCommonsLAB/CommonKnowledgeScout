/**
 * @fileoverview Aggregation zum Agenten-Baum (F1).
 *
 * @description
 * Ordnerknoten aggregieren die Lueckenzaehler ihrer Teilbaeume; die Ampel ist
 * erst gruen, wenn der GESAMTE Teilbaum ohne Befund ist (Akzeptanzkriterium 7).
 * Das Gap-Budget (Sammel-Gaps) laeuft vorher in `gap-budget.ts`.
 *
 * Reine Funktionen, kein I/O; die Reihenfolge ist deterministisch, damit der
 * Report reproduzierbar bleibt (Akzeptanzkriterium 6).
 *
 * @module agent-view
 */

import type { ArchiveFolderNode } from './archive-types'
import type {
  Bearbeitungsstand,
  CoverageAmpel,
  CoverageGap,
  CoverageGapType,
  CoverageTreeNode,
  GapCountByActor,
  GapCountByType,
} from './types'

function emptyActorCounts(): GapCountByActor {
  return { mensch: 0, cowork: 0, knowledgescout: 0 }
}

function ampelOf(node: CoverageTreeNode, blockingGaps: number): CoverageAmpel {
  if (blockingGaps > 0) return 'rot'
  if (node.totalGaps > 0) return 'gelb'
  return 'gruen'
}

/**
 * Baut den Baum und aggregiert die Zaehler von den Blaettern nach oben.
 * `sourceCountByFolder` kommt aus der Twin-Familien-Liste (Quellen, nicht
 * beliebige Dateien).
 */
export function buildTree(args: {
  folders: readonly ArchiveFolderNode[]
  gaps: readonly CoverageGap[]
  sourceCountByFolder: ReadonlyMap<string, number>
}): CoverageTreeNode[] {
  const nodes = new Map<string, CoverageTreeNode>()
  const blocking = new Map<string, number>()

  for (const folder of args.folders) {
    nodes.set(folder.folderId, {
      folderId: folder.folderId,
      name: folder.name,
      path: folder.path,
      depth: folder.depth,
      bearbeitungsstand: folder.bearbeitungsstand as Bearbeitungsstand | null,
      bearbeitungsstandSeit: folder.bearbeitungsstandSeit,
      hasIndex: folder.index !== null,
      hasBericht: folder.bericht !== null,
      sourceCount: args.sourceCountByFolder.get(folder.folderId) ?? 0,
      fileCount: folder.files.length,
      ownGaps: 0,
      totalGaps: 0,
      gapsByType: {},
      gapsByActor: emptyActorCounts(),
      ampel: 'gruen',
      children: [],
    })
  }

  for (const gap of args.gaps) {
    const node = nodes.get(gap.folderId)
    // Kein stiller Verlust: Jeder Befund MUSS an einem gescannten Ordner
    // haengen (der Service loest unbekannte Quellen auf die Wurzel auf).
    if (!node) throw new Error(`Befund ohne Ordner im Baum: ${gap.type} @ ${gap.folderId}`)
    node.ownGaps += 1
  }

  // Kinder verknuepfen (Reihenfolge: Pfad, deterministisch).
  const roots: CoverageTreeNode[] = []
  const sorted = [...args.folders].sort((a, b) => a.path.localeCompare(b.path))
  for (const folder of sorted) {
    const node = nodes.get(folder.folderId)
    if (!node) continue
    const parent = folder.parentFolderId === null ? null : nodes.get(folder.parentFolderId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  // Zaehler von unten nach oben: Ordner absteigend nach Tiefe verarbeiten.
  const byDepth = [...args.folders].sort((a, b) => b.depth - a.depth || b.path.localeCompare(a.path))
  const gapsByFolder = new Map<string, CoverageGap[]>()
  for (const gap of args.gaps) {
    const bucket = gapsByFolder.get(gap.folderId)
    if (bucket) bucket.push(gap)
    else gapsByFolder.set(gap.folderId, [gap])
  }

  for (const folder of byDepth) {
    const node = nodes.get(folder.folderId)
    if (!node) continue
    let total = 0
    let blockingCount = 0
    const byType: GapCountByType = {}
    const byActor = emptyActorCounts()
    for (const gap of gapsByFolder.get(folder.folderId) ?? []) {
      total += 1
      byType[gap.type] = (byType[gap.type] ?? 0) + 1
      byActor[gap.actor] += 1
      if (gap.severity !== 'info') blockingCount += 1
    }
    for (const child of node.children) {
      total += child.totalGaps
      blockingCount += blocking.get(child.folderId) ?? 0
      for (const [type, count] of Object.entries(child.gapsByType)) {
        const key = type as CoverageGapType
        byType[key] = (byType[key] ?? 0) + (count ?? 0)
      }
      byActor.mensch += child.gapsByActor.mensch
      byActor.cowork += child.gapsByActor.cowork
      byActor.knowledgescout += child.gapsByActor.knowledgescout
    }
    node.totalGaps = total
    node.gapsByType = byType
    node.gapsByActor = byActor
    blocking.set(folder.folderId, blockingCount)
    node.ampel = ampelOf(node, blockingCount)
  }

  return roots
}
