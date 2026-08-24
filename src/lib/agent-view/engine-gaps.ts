/**
 * @fileoverview Uebersetzung des Sync-Engine-Checks in Coverage-Befunde.
 *
 * @description
 * Die Twin-Abdeckung wird NICHT neu geprueft — sie kommt vollstaendig aus dem
 * vorhandenen Engine-Plan (`runLibrarySync({ mode: 'check', preset: 'repair' })`).
 * Hier wird sein Report nur in das Lueckenmodell uebersetzt (Leitprinzip 1:
 * Komposition statt Neubau).
 *
 * Die Zuordnung Operationsklasse → Gap-Typ ist als vollstaendiges `Record`
 * gebaut: eine neue Operationsklasse der Engine ist ein TYPFEHLER hier und
 * kann nicht still in einem `default`-Zweig verschwinden
 * (`no-silent-fallbacks.mdc`).
 *
 * @module agent-view
 */

import type { LibrarySyncReport, SourceSyncReportRow } from '@/lib/shadow-twin/sync-engine/report-types'
import type { SyncOperationType } from '@/lib/shadow-twin/sync-plan/types'
import { createGap } from './gap-registry'
import type { CoverageGapType, CoverageGap } from './types'

/** Wo eine Quelle im Baum haengt (aus dem Archiv-Scan aufgeloest). */
export interface SourceLocation {
  folderId: string
  path: string
}

/**
 * Welche Engine-Operation erzeugt welchen Befund? `null` = keine Luecke,
 * sondern eine gewoehnliche Reparatur-Operation (die Agentensicht meldet nur
 * Zustaende, keine To-dos der Engine).
 */
const OPERATION_TO_GAP: Record<SyncOperationType, CoverageGapType | null> = {
  'write-canonical-transcript': null,
  'update-mongo-transcript': null,
  'update-mongo-transformation': null,
  'mirror-artifact-to-storage': null,
  'mirror-image-to-storage': null,
  'register-image-fragments': null,
  'delete-inferior-variant': null,
  'delete-dead-page-md': null,
  'adopt-storage-only-source': null,
  'migrate-legacy-artifact-name': 'legacy_twin_name',
  'split-combined-artifact': 'legacy_twin_name',
  'needs-pipeline': 'twin_stale',
  conflict: 'conflict',
  'legacy-transcript-name': 'legacy_twin_name',
  'path-too-long': 'path_too_long',
}

function locate(row: SourceSyncReportRow, locations: ReadonlyMap<string, SourceLocation>, rootFolderId: string): SourceLocation {
  return locations.get(row.sourceId) ?? { folderId: rootFolderId, path: row.sourceName }
}

/** Uebersetzt EINE Report-Zeile in Befunde. */
export function gapsFromSyncRow(
  row: SourceSyncReportRow,
  locations: ReadonlyMap<string, SourceLocation>,
  rootFolderId: string,
): CoverageGap[] {
  const where = locate(row, locations, rootFolderId)
  const base = {
    scope: 'source' as const,
    targetId: row.sourceId,
    targetName: row.sourceName,
    folderId: where.folderId,
    path: where.path,
  }
  const gaps: CoverageGap[] = []

  if (row.error) {
    gaps.push(createGap({ ...base, type: 'scan_error', message: 'Diese Datei liess sich nicht pruefen', detail: row.error }))
  }

  const seen = new Set<CoverageGapType>()
  let adoptable = false
  for (const op of row.operations) {
    if (op.type === 'adopt-storage-only-source') adoptable = true
    const gapType = OPERATION_TO_GAP[op.type]
    if (!gapType || seen.has(gapType)) continue
    seen.add(gapType)
    gaps.push(
      createGap({
        ...base,
        type: gapType,
        message: `Die Ablage muss aufgeraeumt werden (${op.type})`,
        detail: op.note ?? `${op.kind} ${op.fileName}`,
      }),
    )
  }

  // Ohne Transkript UND ohne adoptierbare Artefakte im Spiegel ist die Quelle
  // unerschlossen (Contract §2 Discovery-Regel).
  if (row.transcriptStatus === 'empty' && !adoptable) {
    gaps.push(
      createGap({
        ...base,
        type: 'source_without_twin',
        message: 'Zu dieser Datei gibt es noch kein Transkript',
        detail: 'Discovery-Regel: `_<Quelle>/` fehlt oder enthaelt kein Transkript',
      }),
    )
  }

  return gaps
}

/** Uebersetzt den gesamten Engine-Report. */
export function gapsFromSyncReport(args: {
  report: LibrarySyncReport
  locations: ReadonlyMap<string, SourceLocation>
  rootFolderId: string
}): CoverageGap[] {
  const gaps = args.report.sources.flatMap((row) => gapsFromSyncRow(row, args.locations, args.rootFolderId))
  if (args.report.sourcesTruncated) {
    gaps.push(
      createGap({
        type: 'scan_error',
        scope: 'library',
        targetId: args.rootFolderId,
        targetName: '(Library)',
        folderId: args.rootFolderId,
        path: '',
        message: 'Die Pruefliste wurde gekuerzt — nicht alle Dateien sind enthalten',
        detail: `${args.report.sources.length} von ${args.report.totalSources} Quellen im Detail`,
      }),
    )
  }
  return gaps
}
