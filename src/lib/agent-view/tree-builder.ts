/**
 * @fileoverview Aggregation zum Agenten-Baum (F1).
 *
 * @description
 * Ordnerknoten aggregieren die Lueckenzaehler ihrer Teilbaeume; die Ampel ist
 * erst gruen, wenn der GESAMTE Teilbaum ohne Befund ist (Akzeptanzkriterium 7).
 * Seit dem Beschluss vom 24.08.2026 ist die Ampel AKTEUR-basiert (eine
 * Geschichte mit „bereit zur Abnahme", kein zweites Urteil): rot = maschinelle
 * Befunde (Cowork/KnowledgeScout) offen, gelb = alles wartet auf den Menschen,
 * gruen = kein Befund. Das Gap-Budget (Sammel-Gaps) laeuft vorher in
 * `gap-budget.ts`.
 *
 * Reine Funktionen, kein I/O; die Reihenfolge ist deterministisch, damit der
 * Report reproduzierbar bleibt (Akzeptanzkriterium 6).
 *
 * @module agent-view
 */

import { zaehleWiderstaende } from './abnahme'
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

/**
 * Ampel (Beschluss 24.08.2026, verschaerft durch ADR 0006): rot = Widerstand
 * offen — maschinelle Befunde (auch `info`: die Maschine hat noch Arbeit)
 * oder eine Fehler-Markierung des Menschen; gelb = kein Widerstand, aber ein
 * Mensch-Befund will Aufmerksamkeit (z. B. `stand_widerspruch`); gruen = kein
 * Befund im Teilbaum. Der strengere F8/W7-Precheck (nur error/warning,
 * frischer Scan) bleibt davon getrennt.
 */
function ampelOf(byActor: GapCountByActor, byType: GapCountByType): CoverageAmpel {
  if (zaehleWiderstaende(byActor, byType) > 0) return 'rot'
  if (byActor.mensch > 0) return 'gelb'
  return 'gruen'
}

/**
 * Setzt die Zaehler eines BESTEHENDEN Baums neu: `ownGaps`, `totalGaps`,
 * `gapsByType`, `gapsByActor`, `ampel` — bottom-up (Post-Order). Auch der
 * W8-Merge nutzt genau diese Funktion, damit Voll-Scan und Merge dasselbe
 * Urteil faellen (keine zweite Aggregation, kein Drift).
 */
export function aggregiereZaehler(
  roots: readonly CoverageTreeNode[],
  gaps: readonly CoverageGap[],
): void {
  const gapsByFolder = new Map<string, CoverageGap[]>()
  for (const gap of gaps) {
    const bucket = gapsByFolder.get(gap.folderId)
    if (bucket) bucket.push(gap)
    else gapsByFolder.set(gap.folderId, [gap])
  }

  const bekannt = new Set<string>()
  const walk = (node: CoverageTreeNode): void => {
    bekannt.add(node.folderId)
    let total = 0
    const byType: GapCountByType = {}
    const byActor = emptyActorCounts()
    const eigene = gapsByFolder.get(node.folderId) ?? []
    node.ownGaps = eigene.length
    for (const gap of eigene) {
      total += 1
      byType[gap.type] = (byType[gap.type] ?? 0) + 1
      byActor[gap.actor] += 1
    }
    for (const child of node.children) {
      walk(child)
      total += child.totalGaps
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
    node.ampel = ampelOf(byActor, byType)
  }
  for (const root of roots) walk(root)

  // Kein stiller Verlust: Jeder Befund MUSS an einem Ordner des Baums haengen
  // (der Service loest unbekannte Quellen auf die Wurzel auf).
  for (const gap of gaps) {
    if (!bekannt.has(gap.folderId)) {
      throw new Error(`Befund ohne Ordner im Baum: ${gap.type} @ ${gap.folderId}`)
    }
  }
}

/**
 * Baut den Baum und aggregiert die Zaehler von den Blaettern nach oben.
 * `sourceCountByFolder` kommt aus der Twin-Familien-Liste (Quellen, nicht
 * beliebige Dateien); `ownChangeByFolder` traegt die juengste eigene
 * Aenderung in die Knoten (W8-Merge-Grundlage).
 */
export function buildTree(args: {
  folders: readonly ArchiveFolderNode[]
  gaps: readonly CoverageGap[]
  sourceCountByFolder: ReadonlyMap<string, number>
  ownChangeByFolder: ReadonlyMap<string, string | null>
}): CoverageTreeNode[] {
  const nodes = new Map<string, CoverageTreeNode>()

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
      neuesteEigeneAenderung: args.ownChangeByFolder.get(folder.folderId) ?? null,
      berichtFileId: folder.bericht?.fileId ?? null,
      berichtModifiedAt: folder.bericht?.modifiedAt ?? null,
      children: [],
    })
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

  aggregiereZaehler(roots, args.gaps)
  return roots
}
