/**
 * @fileoverview Kennzahlen-Aggregation des Coverage-Reports.
 *
 * @description
 * Zaehlt Befunde je Typ und Akteur und baut den `totals`-Block. Die
 * Ausschluss-Zaehler beider Scans (Archiv + Engine) bleiben getrennt
 * sichtbar (`no-silent-fallbacks`). Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { ArchiveScanResult } from './archive-types'
import type { TwinFamilyView } from './twin-rules'
import type { CoverageGap, CoverageTotals, GapCountByActor, GapCountByType } from './types'

/** Befunde je Typ/Akteur zaehlen — auch der W8-Merge zaehlt hierueber (kein Drift). */
export function tally(gaps: readonly CoverageGap[]): { byType: GapCountByType; byActor: GapCountByActor } {
  const byType: GapCountByType = {}
  const byActor: GapCountByActor = { mensch: 0, cowork: 0, knowledgescout: 0 }
  for (const gap of gaps) {
    byType[gap.type] = (byType[gap.type] ?? 0) + 1
    byActor[gap.actor] += 1
  }
  return { byType, byActor }
}

export function buildTotals(args: {
  folders: ArchiveScanResult['folders']
  families: readonly TwinFamilyView[]
  gaps: readonly CoverageGap[]
  archive: ArchiveScanResult
  budget: number
  /** Ausschluesse, die die Sync-Engine gezaehlt hat (Welle 0b). */
  engineSkippedExcluded: number
}): CoverageTotals {
  const { byType, byActor } = tally(args.gaps)
  return {
    folders: args.folders.length,
    files: args.folders.reduce((sum, folder) => sum + folder.files.length, 0),
    sources: args.families.length,
    twins: args.families.reduce((sum, family) => sum + family.artifacts.length, 0),
    gaps: args.gaps.length,
    gapsByType: byType,
    gapsByActor: byActor,
    skippedExcluded: { archive: args.archive.skippedExcluded, engine: args.engineSkippedExcluded },
    collapsedGaps: args.budget,
    scanErrors: args.gaps.filter((gap) => gap.type === 'scan_error').length,
  }
}
