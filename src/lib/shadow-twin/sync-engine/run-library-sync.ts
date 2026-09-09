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
 * Stufe 1 „Twin-Fingerabdruck": Im Modus `check` steht vor der Sammlung ein
 * Tor (`check-stand.ts`). Hat sich seit dem letzten Lauf weder das Listing der
 * Twin-Familie noch das Mongo-Dokument geaendert, wird die gespeicherte
 * Report-Zeile wiederverwendet — ohne `getBinary`. Der Modus `repair`
 * verwendet nie wieder.
 *
 * @module shadow-twin/sync-engine
 */

import { effectiveScanExcludeGlobs } from './scan-exclude'
import { FileLogger } from '@/lib/debug/logger'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { planSourceSync, type SourceSyncPlan } from '@/lib/shadow-twin/sync-plan/plan-source-sync'
import { filterAllowedOperations, type SyncPreset } from '@/lib/shadow-twin/sync-plan/allowed-ops'
import { DEFAULT_PATH_BUDGET } from '@/lib/shadow-twin/sync-plan/plan-name-migration'
import { clearCheckStand, setCheckStand } from '@/lib/repositories/shadow-twin-check-stand'
import { pruefeCheckStand, type CheckStandKennung } from './check-stand'
import type { NameMigrationContext } from './collect-name-migration'
import { collectSourceInput, type CollectedSource } from './collect-source-input'
import { collectStorageOnlySource } from './collect-storage-only-source'
import { executeSourcePlan, type OperationOutcome } from './execute-source-plan'
import { FolderCache } from './folder-cache'
import { baueOperationsReport, verbucheAusfuehrung, verbucheZeile } from './report-tally'
import { resolveSources, type LibrarySyncScope } from './resolve-sources'
import type { LibrarySyncReport, SourceSyncReportRow, SyncMode } from './report-types'

export type { LibrarySyncScope } from './resolve-sources'

const DEFAULT_MAX_SOURCE_DETAILS = 500

/** Fuehrt einen Sync-Lauf aus (check ODER repair) und liefert den Report. */
export async function runLibrarySync(args: {
  libraryId: string
  userEmail: string
  mode: SyncMode
  preset?: SyncPreset
  scope?: LibrarySyncScope
  maxSourceDetails?: number
  /** Pfad-Budget der Namens-Migration in Zeichen (Default {@link DEFAULT_PATH_BUDGET}). */
  pathBudget?: number
  /** Fingerabdruck-Tor umgehen: jede Quelle frisch lesen und planen. */
  erzwingen?: boolean
}): Promise<LibrarySyncReport> {
  const { libraryId, userEmail, mode, preset = 'repair', scope = {}, maxSourceDetails = DEFAULT_MAX_SOURCE_DETAILS, pathBudget = DEFAULT_PATH_BUDGET, erzwingen = false } = args

  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) throw new Error(`Library nicht gefunden: ${libraryId}`)
  const provider = await getServerProvider(userEmail, libraryId)
  if (!provider) throw new Error('Storage-Provider nicht verfuegbar')
  const persistToFilesystem = getShadowTwinConfig(library).persistToFilesystem
  // Namens-Migration (Welle 5c): Template + Zielsprache aus der Library-Config;
  // ohne Template plant die Engine Report-Befunde statt Renames.
  const secretaryConfig = library.config?.secretaryService
  const baseNameMigrationCtx: Omit<NameMigrationContext, 'parentPathLength'> = {
    templateName: secretaryConfig?.template?.trim() || null,
    splitTargetLanguage: secretaryConfig?.targetLanguage || 'de',
    pathBudget,
  }

  const folderCache = new FolderCache(provider)
  const { pairs, scannedFiles, skippedWithoutDoc, skippedExcluded } = await resolveSources({
    libraryId, scope, folderCache, provider,
    // Welle 0b: Ausschluss-Muster der Library (temp/ u. Ae. bleiben draussen, aber sichtbar gezaehlt).
    // D3: leer konfiguriert -> dokumentierter Plattform-Default (scan-exclude.ts).
    excludeGlobs: effectiveScanExcludeGlobs(library.config?.scanExcludeGlobs),
  })

  const report: LibrarySyncReport = {
    libraryId, mode, preset,
    totalSources: pairs.length, scannedFiles, skippedWithoutDoc, skippedExcluded,
    changed: 0, conflicts: 0, needsPipeline: 0, needsReextract: 0,
    planned: {}, selected: {}, executed: {}, failed: {},
    errors: 0, wiederverwendet: 0, gelesen: 0, sources: [], sourcesTruncated: false,
  }

  /** Zeile in den Report legen (mit Kappungs-Grenze). */
  const merkeZeile = (zeile: SourceSyncReportRow): void => {
    if (report.sources.length < maxSourceDetails) report.sources.push(zeile)
    else report.sourcesTruncated = true
  }

  for (const { doc, sourceItem, parentPathLength } of pairs) {
    let row: SourceSyncReportRow
    try {
      const nameMigrationCtx: NameMigrationContext = { ...baseNameMigrationCtx, parentPathLength: parentPathLength ?? null }

      // Fingerabdruck-Tor (nur check): unveraenderte Familie → letzte Zeile
      // wiederverwenden. Schlaegt das Listing fehl, gibt es kein Tor — der
      // volle Weg laeuft und meldet den Fehler (`no-silent-fallbacks`).
      let kennung: CheckStandKennung | null = null
      if (mode === 'check' && doc) {
        const tor = await pruefeCheckStand({ doc, folderCache, parentPathLength: parentPathLength ?? null })
          .catch((err: unknown) => {
            FileLogger.warn('shadow-twins/sync-engine', 'Fingerabdruck-Tor uebersprungen (Listing nicht lesbar)', {
              sourceId: doc.sourceId, error: err instanceof Error ? err.message : String(err),
            })
            return null
          })
        if (tor && !erzwingen && tor.zeile) {
          report.wiederverwendet++
          verbucheZeile(report, tor.zeile)
          merkeZeile(tor.zeile)
          continue
        }
        kennung = tor?.aktuell ?? null
      }

      // Doc-Pfad wie bisher; Storage-only-Quellen (Welle 5a) liefern dieselben
      // Formen (CollectedSource + Plan) und laufen durch identisches Reporting.
      let collected: CollectedSource
      let plan: SourceSyncPlan
      if (doc) {
        collected = await collectSourceInput({ doc, provider, folderCache, sourceItem, nameMigrationCtx })
        plan = planSourceSync(collected.input)
      } else {
        const adoption = sourceItem
          ? await collectStorageOnlySource({ sourceItem, folderCache, provider, nameMigrationCtx })
          : null
        if (!adoption) {
          // Ohne Doc und ohne adoptierbare Artefakte: gewoehnliche Datei.
          report.totalSources--
          report.skippedWithoutDoc++
          continue
        }
        collected = adoption.collected
        plan = adoption.plan
      }
      report.gelesen++
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
      const operations = baueOperationsReport({ operations: plan.operations, selected: selectedSet, outcomeByOp, mode })

      row = {
        sourceId: plan.sourceId, sourceName: collected.input.sourceName,
        transcriptStatus: plan.transcriptStatus,
        winnerName: plan.winnerName, winnerOrigin: plan.winnerOrigin, winnerPages: plan.winnerPages,
        operations,
        notes: [...collected.collectNotes, ...plan.notes],
      }
      // Aus der Zeile zaehlen, nicht aus dem Plan: eine wiederverwendete Zeile
      // laeuft durch dieselbe Funktion und kann so nicht anders zaehlen.
      verbucheZeile(report, row)
      verbucheAusfuehrung(report, outcomes)

      // Stand fortschreiben: im check festhalten, was gerade gesehen wurde;
      // nach einer Reparatur verwerfen (Storage und Mongo sind jetzt anders).
      if (mode === 'check' && doc && kennung) {
        await setCheckStand({ libraryId, sourceId: doc.sourceId, checkStand: { ...kennung, geprueftAm: new Date().toISOString(), zeile: row } })
      } else if (mode === 'repair' && doc && outcomes.some((o) => o.executed)) {
        await clearCheckStand({ libraryId, sourceId: doc.sourceId })
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

    merkeZeile(row)
  }

  return report
}
