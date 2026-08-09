/**
 * @fileoverview Orchestrator der Sync-Engine: Scope aufloesen, planen, ausfuehren.
 *
 * @description
 * EIN Einstieg fuer alle Faelle (Design §3/§6/§7):
 * - Scope `sourceIds` (per-Datei aus der Archiv-UI), `folderId` (Explorer/Settings,
 *   Storage-getrieben, ueberspringt Twin-Ordner) oder ganze Library (Welle 5a:
 *   Root-Scan VEREINT mit Mongo-Dokumenten ohne Quelldatei — storage-vollstaendig).
 * - Modus `check` = Plan als Report (KEINE Schreib-/Loesch-Operationen);
 *   `repair` = denselben Plan ausfuehren (nur die vom Preset erlaubten Operationen).
 * - Quellen werden batch-weise geladen und einzeln verarbeitet (kein
 *   Alles-in-den-Speicher wie das alte reconcileLibrary).
 *
 * Welle 5a: Dateien ohne Shadow-Twin-Dokument werden nicht mehr uebersprungen —
 * tragen sie Artefakte im Storage, plant die Engine `adopt-storage-only-source`
 * (Uebernahme via Migrations-Writer). Nur Dateien ohne Artefakte zaehlen als
 * `skippedWithoutDoc`.
 *
 * @module shadow-twin/sync-engine
 */

import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { planSourceSync, type SourceSyncPlan } from '@/lib/shadow-twin/sync-plan/plan-source-sync'
import { filterAllowedOperations, type SyncPreset } from '@/lib/shadow-twin/sync-plan/allowed-ops'
import { REPORT_ONLY_OPERATION_TYPES, type SyncOperation } from '@/lib/shadow-twin/sync-plan/types'
import { collectSourceInput, type CollectedSource } from './collect-source-input'
import { collectStorageOnlySource } from './collect-storage-only-source'
import { executeSourcePlan, type OperationOutcome } from './execute-source-plan'
import { FolderCache } from './folder-cache'
import { resolveSources, type LibrarySyncScope } from './resolve-sources'
import type { LibrarySyncReport, OperationCounts, SourceOperationReport, SourceSyncReportRow, SyncMode } from './report-types'

export type { LibrarySyncScope } from './resolve-sources'

const DEFAULT_MAX_SOURCE_DETAILS = 500

function bump(counts: OperationCounts, type: SyncOperation['type']): void {
  counts[type] = (counts[type] ?? 0) + 1
}

/** Fuehrt einen Sync-Lauf aus (check ODER repair) und liefert den Report. */
export async function runLibrarySync(args: {
  libraryId: string
  userEmail: string
  mode: SyncMode
  preset?: SyncPreset
  scope?: LibrarySyncScope
  maxSourceDetails?: number
}): Promise<LibrarySyncReport> {
  const { libraryId, userEmail, mode, preset = 'repair', scope = {}, maxSourceDetails = DEFAULT_MAX_SOURCE_DETAILS } = args

  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) throw new Error(`Library nicht gefunden: ${libraryId}`)
  const provider = await getServerProvider(userEmail, libraryId)
  if (!provider) throw new Error('Storage-Provider nicht verfuegbar')
  const persistToFilesystem = getShadowTwinConfig(library).persistToFilesystem

  const folderCache = new FolderCache(provider)
  const { pairs, scannedFiles, skippedWithoutDoc } = await resolveSources({ libraryId, scope, folderCache, provider })

  const report: LibrarySyncReport = {
    libraryId, mode, preset,
    totalSources: pairs.length, scannedFiles, skippedWithoutDoc,
    changed: 0, conflicts: 0, needsPipeline: 0, needsReextract: 0,
    planned: {}, selected: {}, executed: {}, failed: {},
    errors: 0, sources: [], sourcesTruncated: false,
  }

  for (const { doc, sourceItem } of pairs) {
    let row: SourceSyncReportRow
    try {
      // Doc-Pfad wie bisher; Storage-only-Quellen (Welle 5a) liefern dieselben
      // Formen (CollectedSource + Plan) und laufen durch identisches Reporting.
      let collected: CollectedSource
      let plan: SourceSyncPlan
      if (doc) {
        collected = await collectSourceInput({ doc, provider, folderCache, sourceItem })
        plan = planSourceSync(collected.input)
      } else {
        const adoption = sourceItem ? await collectStorageOnlySource({ sourceItem, folderCache }) : null
        if (!adoption) {
          // Ohne Doc und ohne adoptierbare Artefakte: gewoehnliche Datei.
          report.totalSources--
          report.skippedWithoutDoc++
          continue
        }
        collected = adoption.collected
        plan = adoption.plan
      }
      const selectedOps = filterAllowedOperations(plan.operations, preset, { persistToFilesystem })
      const selectedSet = new Set(selectedOps)

      const outcomes: OperationOutcome[] = mode === 'repair' && selectedOps.length > 0
        ? await executeSourcePlan(selectedOps, {
            library, libraryId, userEmail, provider, folderCache,
            sourceId: plan.sourceId, sourceName: collected.input.sourceName,
            parentId: collected.parentId, shadowTwinFolderId: collected.shadowTwinFolderId,
            twinFolderItems: collected.twinFolderItems, sourceItem: collected.sourceItem,
          })
        : []
      const outcomeByOp = new Map(outcomes.map((o) => [o.operation, o]))

      const operations: SourceOperationReport[] = plan.operations.map((op) => {
        const outcome = outcomeByOp.get(op)
        return {
          type: op.type, kind: op.kind, targetLanguage: op.targetLanguage,
          templateName: op.templateName, fileName: op.fileName,
          overwrite: op.overwrite, count: op.count, note: op.note,
          selected: selectedSet.has(op),
          ...(mode === 'repair' && selectedSet.has(op)
            ? { executed: outcome?.executed === true, ...(outcome?.error ? { error: outcome.error } : {}) }
            : {}),
        }
      })

      for (const op of plan.operations) {
        bump(report.planned, op.type)
        if (selectedSet.has(op)) bump(report.selected, op.type)
        if (op.type === 'conflict') report.conflicts++
        if (op.type === 'needs-pipeline') report.needsPipeline++
      }
      for (const outcome of outcomes) {
        if (REPORT_ONLY_OPERATION_TYPES.has(outcome.operation.type)) continue
        if (outcome.executed) bump(report.executed, outcome.operation.type)
        else {
          bump(report.failed, outcome.operation.type)
          report.errors++
        }
      }
      if (plan.transcriptStatus === 'needs-reextract') report.needsReextract++
      if (selectedOps.length > 0) report.changed++

      row = {
        sourceId: plan.sourceId, sourceName: collected.input.sourceName,
        transcriptStatus: plan.transcriptStatus,
        winnerName: plan.winnerName, winnerOrigin: plan.winnerOrigin, winnerPages: plan.winnerPages,
        operations,
        notes: [...collected.collectNotes, ...plan.notes],
      }
    } catch (err) {
      report.errors++
      row = {
        sourceId: doc?.sourceId ?? sourceItem?.id ?? '', sourceName: doc?.sourceName || sourceItem?.metadata.name || '',
        transcriptStatus: 'empty',
        winnerName: null, winnerOrigin: null, winnerPages: 0,
        operations: [], notes: [],
        error: err instanceof Error ? err.message : String(err),
      }
    }

    if (report.sources.length < maxSourceDetails) report.sources.push(row)
    else report.sourcesTruncated = true
  }

  return report
}
