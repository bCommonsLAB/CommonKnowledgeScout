/**
 * @fileoverview Gap-Budget: Sammel-Gaps statt tausend Einzel-Befunde.
 *
 * @description
 * Ordner mit `bearbeitungsstand: ungesichtet` sind erklaertermassen noch nicht
 * gesichtet — ihre Teilbaeume erzeugen deshalb EINEN Sammel-Gap
 * (`teilbaum_ungesichtet`) statt jeder Datei einen eigenen Befund
 * (Projektauftrag F2, Gap-Budget). Scan-Fehler und Stand-Widersprueche werden
 * NIE zusammengefasst — der Betriebszustand darf nicht hinter dem Budget
 * verschwinden.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { ArchiveFolderNode } from './archive-types'
import { createGap } from './gap-registry'
import type { CoverageGap, CoverageGapType } from './types'

/** Befund-Typen, die das Gap-Budget NICHT zusammenfasst. */
const NEVER_COLLAPSED: ReadonlySet<CoverageGapType> = new Set<CoverageGapType>([
  'scan_error',
  'teilbaum_ungesichtet',
  'stand_widerspruch',
])

/** Ordner-Id → Id des naechsten `ungesichtet`-Vorfahren (inkl. sich selbst). */
export function collapseRootByFolder(folders: readonly ArchiveFolderNode[]): Map<string, string> {
  const byId = new Map(folders.map((folder) => [folder.folderId, folder]))
  const result = new Map<string, string>()
  for (const folder of folders) {
    let current: ArchiveFolderNode | undefined = folder
    const chain: string[] = []
    let root: string | null = null
    while (current) {
      chain.push(current.folderId)
      if (current.bearbeitungsstand === 'ungesichtet') root = current.folderId
      current = current.parentFolderId === null ? undefined : byId.get(current.parentFolderId)
    }
    // Der AEUSSERSTE ungesichtete Vorfahre gewinnt (ein Sammel-Gap je Teilbaum).
    if (root !== null) for (const id of chain) if (!result.has(id)) result.set(id, root)
  }
  return result
}

export interface GapBudgetResult {
  gaps: CoverageGap[]
  /** Anzahl zusammengefasster Einzel-Befunde. */
  collapsed: number
}

/** Fasst Befunde unterhalb `ungesichtet`-Ordnern zu Sammel-Gaps zusammen. */
export function applyGapBudget(
  folders: readonly ArchiveFolderNode[],
  gaps: readonly CoverageGap[],
): GapBudgetResult {
  const collapseRoot = collapseRootByFolder(folders)
  if (collapseRoot.size === 0) return { gaps: [...gaps], collapsed: 0 }

  const byId = new Map(folders.map((folder) => [folder.folderId, folder]))
  const kept: CoverageGap[] = []
  const collapsedCount = new Map<string, number>()

  for (const gap of gaps) {
    const root = collapseRoot.get(gap.folderId)
    if (root === undefined || NEVER_COLLAPSED.has(gap.type)) {
      kept.push(gap)
      continue
    }
    collapsedCount.set(root, (collapsedCount.get(root) ?? 0) + 1)
  }

  let collapsed = 0
  for (const [folderId, count] of [...collapsedCount.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const folder = byId.get(folderId)
    if (!folder) throw new Error(`Sammel-Gap ohne Ordner: ${folderId}`)
    collapsed += count
    kept.push(
      createGap({
        type: 'teilbaum_ungesichtet',
        scope: 'folder',
        targetId: folder.folderId,
        targetName: folder.name || '(Wurzel)',
        folderId: folder.folderId,
        path: folder.path,
        message: `Ungesichteter Teilbaum — ${count} Einzelbefund(e) zusammengefasst`,
        detail: 'bearbeitungsstand: ungesichtet — erst sichten (Zyklus Schritt 1), dann einzeln bewerten',
      }),
    )
  }
  return { gaps: kept, collapsed }
}
