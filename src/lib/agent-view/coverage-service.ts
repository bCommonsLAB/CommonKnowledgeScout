/**
 * @fileoverview Coverage-Service — die Kompositionsschicht der Agentensicht.
 *
 * @description
 * Orchestriert die VORHANDENEN Pruefmaschinen und ergaenzt nur, was keine
 * kann (Projektauftrag §2 Leitprinzip 1):
 *
 * 1. Sync-Engine-Check (`mode: 'check'`, `preset: 'repair'`) → Twin-Abdeckung,
 *    Konflikte, Alt-Namen, Pfad-Budget.
 * 2. Twin-Kern-/Verifikationsregeln aus `twin-core-fields.ts` (keine zweite
 *    Felddefinition).
 * 3. Archiv-Konventionen (`_INDEX.md`/`BERICHT.md`, Soll/Ist am Stand).
 * 4. Verweis-Audit (doppelte Buchhaltung, ohne LLM).
 *
 * Coverage wird BERECHNET; das Ergebnis (`CoverageReport`) ist abgeleitet und
 * wegwerfbar. Erklaerte Staende werden ausschliesslich GELESEN.
 *
 * Alle Aussenzugriffe laufen ueber Ports — damit ist der Service ohne Storage
 * und ohne MongoDB unit-testbar (Vorbild: `LibraryDocumentSource` in A1).
 *
 * @module agent-view
 */

import type { LibrarySyncReport } from '@/lib/shadow-twin/sync-engine/report-types'
import { compileVorhabenPattern, evaluateArchiveRules } from './archive-rules'
import type { ArchiveScanResult } from './archive-types'
import { buildFileIndex, buildNewestChangeBySubtree, locateFamilies, type RawTwinFamily } from './coverage-inputs'
import { auditAllDocuments } from './document-audit'
import { gapsFromSyncReport, type SourceLocation } from './engine-gaps'
import { applyGapBudget } from './gap-budget'
import { sortGaps } from './gap-registry'
import { orphanTwinDocuments, orphanTwinFolders } from './inventory-gaps'
import { checkStandWiderspruch } from './stand-widerspruch'
import { buildTree } from './tree-builder'
import { evaluateTwinRules, type TwinFamilyView } from './twin-rules'
import type { CoverageConventions, CoverageGap, CoverageGapType, CoverageReport, CoverageTotals, GapCountByActor, GapCountByType } from './types'
import { buildVorhabenCards } from './vorhaben-board'

/** Aussenzugriffe des Scans — in Tests vollstaendig ersetzbar. */
export interface CoverageScanPorts {
  scanArchive(args: { rootFolderId: string; excludeGlobs: readonly string[] }): Promise<ArchiveScanResult>
  runSyncCheck(args: { folderId: string | null }): Promise<LibrarySyncReport>
  loadTwinFamilies(): Promise<RawTwinFamily[]>
  /** Zeitquelle (injiziert, damit Reports reproduzierbar testbar sind). */
  now(): string
}

export interface CoverageScanRequest {
  libraryId: string
  /** Scan-Wurzel im Storage (Library-Wurzel oder Teilbaum). */
  rootFolderId: string
  /** Gesetzt, wenn nur ein Teilbaum gescannt wurde (Scope-Kennzeichnung). */
  scopeFolderId: string | null
  conventions: CoverageConventions
}

function tally(gaps: readonly CoverageGap[]): { byType: GapCountByType; byActor: GapCountByActor } {
  const byType: GapCountByType = {}
  const byActor: GapCountByActor = { mensch: 0, cowork: 0, knowledgescout: 0 }
  for (const gap of gaps) {
    byType[gap.type] = (byType[gap.type] ?? 0) + 1
    byActor[gap.actor] += 1
  }
  return { byType, byActor }
}

/** Fuehrt EINEN Coverage-Scan aus und liefert den (wegwerfbaren) Report. */
export async function runCoverageScan(
  request: CoverageScanRequest,
  ports: CoverageScanPorts,
): Promise<CoverageReport> {
  const { conventions } = request
  const vorhabenPattern = compileVorhabenPattern(conventions.vorhabenFolderPattern)

  const [archive, syncReport, rawFamilies] = await Promise.all([
    ports.scanArchive({ rootFolderId: request.rootFolderId, excludeGlobs: conventions.scanExcludeGlobs }),
    ports.runSyncCheck({ folderId: request.scopeFolderId }),
    ports.loadTwinFamilies(),
  ])

  const folders = archive.folders
  const folderIds = new Set(folders.map((folder) => folder.folderId))
  const fileIndex = buildFileIndex(folders)
  const families = locateFamilies({ families: rawFamilies, fileIndex, folderIds, rootFolderId: request.rootFolderId })
  const newestChange = buildNewestChangeBySubtree({ folders, families })

  const locations = new Map<string, SourceLocation>(
    [...fileIndex.entries()].map(([fileId, location]) => [fileId, { folderId: location.folderId, path: location.path }]),
  )

  const gaps: CoverageGap[] = [
    ...gapsFromSyncReport({ report: syncReport, locations, rootFolderId: request.rootFolderId }),
    ...families.flatMap((family) => evaluateTwinRules(family, conventions.standardTemplate)),
    ...orphanTwinFolders(folders),
    // Twin-Dokumente ohne Scan-Fund sind nur beim Library-weiten Scan
    // aussagekraeftig — im Teilbaum-Scope liegt die Quelle womoeglich
    // ausserhalb (kein Raten, siehe inventory-gaps.ts).
    ...(request.scopeFolderId === null
      ? orphanTwinDocuments({ families, scannedFileIds: new Set(fileIndex.keys()), rootFolderId: request.rootFolderId })
      : []),
    ...folders.flatMap((folder) =>
      evaluateArchiveRules(folder, {
        conventions,
        vorhabenPattern,
        newestChangeInSubtree: newestChange.get(folder.folderId) ?? null,
      }),
    ),
    ...auditAllDocuments({ folders, families, fileIndex, vorhabenPattern }),
  ]

  const budget = applyGapBudget(folders, gaps)
  const sourceCountByFolder = countSourcesByFolder(families)
  const firstPass = buildTree({ folders, gaps: budget.gaps, sourceCountByFolder })

  const standGaps: CoverageGap[] = []
  for (const node of flattenNodes(firstPass)) {
    const gap = checkStandWiderspruch({
      node,
      newestChangeInSubtree: newestChange.get(node.folderId) ?? null,
      subtreeGapTypes: Object.keys(node.gapsByType) as CoverageGapType[],
    })
    if (gap) standGaps.push(gap)
  }

  const effectiveGaps = sortGaps([...budget.gaps, ...standGaps])
  const tree = buildTree({ folders, gaps: effectiveGaps, sourceCountByFolder })
  const totals = buildTotals({
    folders, families, gaps: effectiveGaps, archive,
    budget: budget.collapsed,
    engineSkippedExcluded: syncReport.skippedExcluded ?? 0,
  })

  return {
    libraryId: request.libraryId,
    generatedAt: ports.now(),
    derived: true,
    scope: { folderId: request.scopeFolderId },
    conventions,
    totals,
    gaps: effectiveGaps,
    tree,
    vorhaben: buildVorhabenCards({ folders, tree, gaps: effectiveGaps, vorhabenPattern }),
  }
}

function countSourcesByFolder(families: readonly TwinFamilyView[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const family of families) counts.set(family.folderId, (counts.get(family.folderId) ?? 0) + 1)
  return counts
}

function flattenNodes(nodes: ReturnType<typeof buildTree>): ReturnType<typeof buildTree> {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)])
}

function buildTotals(args: {
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
