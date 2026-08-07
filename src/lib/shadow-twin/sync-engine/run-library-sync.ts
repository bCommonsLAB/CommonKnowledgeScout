/**
 * @fileoverview Orchestrator der Sync-Engine: Scope aufloesen, planen, ausfuehren.
 *
 * @description
 * EIN Einstieg fuer alle Faelle (Design §3/§6/§7):
 * - Scope `sourceIds` (per-Datei aus der Archiv-UI), `folderId` (Explorer/Settings,
 *   Storage-getrieben, ueberspringt Twin-Ordner) oder ganze Library (Mongo-getrieben).
 * - Modus `check` = Plan als Report (KEINE Schreib-/Loesch-Operationen);
 *   `repair` = denselben Plan ausfuehren (nur die vom Preset erlaubten Operationen).
 * - Quellen werden batch-weise geladen und einzeln verarbeitet (kein
 *   Alles-in-den-Speicher wie das alte reconcileLibrary).
 *
 * Dateien ohne Shadow-Twin-Dokument werden uebersprungen und gezaehlt —
 * Neu-Import aus dem Dateisystem bleibt Sache von „Aus Dateisystem laden" (migrate).
 *
 * @module shadow-twin/sync-engine
 */

import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { getAllShadowTwins, getShadowTwinsBySourceIds, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { isShadowTwinFolderName } from '@/lib/storage/shadow-twin-folder-name'
import { planSourceSync } from '@/lib/shadow-twin/sync-plan/plan-source-sync'
import { filterAllowedOperations, type SyncPreset } from '@/lib/shadow-twin/sync-plan/allowed-ops'
import { REPORT_ONLY_OPERATION_TYPES, type SyncOperation } from '@/lib/shadow-twin/sync-plan/types'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import { collectSourceInput } from './collect-source-input'
import { executeSourcePlan, type OperationOutcome } from './execute-source-plan'
import { FolderCache } from './folder-cache'
import type { LibrarySyncReport, OperationCounts, SourceOperationReport, SourceSyncReportRow, SyncMode } from './report-types'

export interface LibrarySyncScope {
  /** Teilmenge konkreter Quellen (per-Datei-Aufrufe der Archiv-UI). */
  sourceIds?: string[]
  /** Storage-getriebener Scan ab diesem Ordner (Explorer, Settings-Pruefen). */
  folderId?: string
  recursive?: boolean
}

const DEFAULT_MAX_SOURCE_DETAILS = 500
const DOC_BATCH_SIZE = 100

function bump(counts: OperationCounts, type: SyncOperation['type']): void {
  counts[type] = (counts[type] ?? 0) + 1
}

/** Quellen-Liste aufloesen: [doc, ggf. Quell-Item aus dem Scan]. */
async function resolveSources(args: {
  libraryId: string
  scope: LibrarySyncScope
  folderCache: FolderCache
  provider: StorageProvider
}): Promise<{ pairs: Array<{ doc: ShadowTwinDocument; sourceItem: StorageItem | null }>; scannedFiles?: number; skippedWithoutDoc: number }> {
  const { libraryId, scope, folderCache, provider } = args

  if (scope.sourceIds?.length) {
    const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: scope.sourceIds })
    const pairs: Array<{ doc: ShadowTwinDocument; sourceItem: StorageItem | null }> = []
    for (const sourceId of scope.sourceIds) {
      const doc = docs.get(sourceId)
      if (!doc) continue
      let sourceItem: StorageItem | null = null
      try {
        sourceItem = await provider.getItemById(sourceId)
      } catch {
        // Quelle nicht (mehr) aufloesbar → needs-pipeline entfaellt, Plan laeuft trotzdem.
      }
      pairs.push({ doc, sourceItem })
    }
    return { pairs, skippedWithoutDoc: scope.sourceIds.length - pairs.length }
  }

  if (scope.folderId) {
    // Storage-getrieben: Dateien rekursiv sammeln, Twin-Ordner NICHT als Quellen scannen.
    const files: StorageItem[] = []
    const queue: string[] = [scope.folderId]
    while (queue.length > 0) {
      const current = queue.shift() as string
      for (const item of await folderCache.list(current)) {
        if (item.type === 'folder') {
          if (scope.recursive !== false && !isShadowTwinFolderName(item.metadata.name)) queue.push(item.id)
          continue
        }
        files.push(item)
      }
    }
    const pairs: Array<{ doc: ShadowTwinDocument; sourceItem: StorageItem | null }> = []
    for (let i = 0; i < files.length; i += DOC_BATCH_SIZE) {
      const batch = files.slice(i, i + DOC_BATCH_SIZE)
      const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: batch.map((f) => f.id) })
      for (const file of batch) {
        const doc = docs.get(file.id)
        if (doc) pairs.push({ doc, sourceItem: file })
      }
    }
    return { pairs, scannedFiles: files.length, skippedWithoutDoc: files.length - pairs.length }
  }

  // Ganze Library, Mongo-getrieben (erfasst auch Quellen, deren Datei weg ist).
  const docs = await getAllShadowTwins(libraryId)
  return { pairs: docs.map((doc) => ({ doc, sourceItem: null })), skippedWithoutDoc: 0 }
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
      const collected = await collectSourceInput({ doc, provider, folderCache, sourceItem })
      const plan = planSourceSync(collected.input)
      const selectedOps = filterAllowedOperations(plan.operations, preset, { persistToFilesystem })
      const selectedSet = new Set(selectedOps)

      const outcomes: OperationOutcome[] = mode === 'repair' && selectedOps.length > 0
        ? await executeSourcePlan(selectedOps, {
            library, libraryId, userEmail, provider, folderCache,
            sourceId: doc.sourceId, sourceName: collected.input.sourceName,
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
        sourceId: doc.sourceId, sourceName: collected.input.sourceName,
        transcriptStatus: plan.transcriptStatus, operations,
        notes: [...collected.collectNotes, ...plan.notes],
      }
    } catch (err) {
      report.errors++
      row = {
        sourceId: doc.sourceId, sourceName: doc.sourceName || '',
        transcriptStatus: 'empty', operations: [], notes: [],
        error: err instanceof Error ? err.message : String(err),
      }
    }

    if (report.sources.length < maxSourceDetails) report.sources.push(row)
    else report.sourcesTruncated = true
  }

  return report
}
