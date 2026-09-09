/**
 * @fileoverview Zaehler des Sync-Reports — aus dem Orchestrator herausgeloest.
 *
 * @description
 * Beide Wege des check-Modus muessen dieselben Zahlen ergeben: der volle Weg
 * (planen und zaehlen) und das Fingerabdruck-Tor (gespeicherte Zeile
 * wiederverwenden). Deshalb zaehlt EINE Funktion — und zwar aus der fertigen
 * Report-Zeile, nicht aus dem Plan. Eine wiederverwendete Zeile kann so gar
 * nicht anders zaehlen als eine frisch geplante.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module shadow-twin/sync-engine
 */

import { REPORT_ONLY_OPERATION_TYPES, type SyncOperation } from '@/lib/shadow-twin/sync-plan/types'
import type { OperationOutcome } from './execute-source-plan'
import type { LibrarySyncReport, OperationCounts, SourceOperationReport, SourceSyncReportRow, SyncMode } from './report-types'

function bump(counts: OperationCounts, type: SyncOperation['type']): void {
  counts[type] = (counts[type] ?? 0) + 1
}

/**
 * Uebersetzt den Plan in Report-Operationen (ohne Markdown — der Report bleibt
 * schlank). `executed`/`error` nur im repair-Modus und nur fuer das, was das
 * Preset ausgewaehlt hat.
 */
export function baueOperationsReport(args: {
  operations: readonly SyncOperation[]
  selected: ReadonlySet<SyncOperation>
  outcomeByOp: ReadonlyMap<SyncOperation, OperationOutcome>
  mode: SyncMode
}): SourceOperationReport[] {
  const { operations, selected, outcomeByOp, mode } = args
  return operations.map((op) => {
    const outcome = outcomeByOp.get(op)
    return {
      type: op.type, kind: op.kind, targetLanguage: op.targetLanguage,
      templateName: op.templateName, fileName: op.fileName, newFileName: op.newFileName,
      overwrite: op.overwrite, count: op.count, note: op.note,
      selected: selected.has(op),
      ...(mode === 'repair' && selected.has(op)
        ? { executed: outcome?.executed === true, ...(outcome?.error ? { error: outcome.error } : {}) }
        : {}),
    }
  })
}

/**
 * Verbucht eine Report-Zeile in den Report-Zaehlern (geplant, im Preset,
 * Konflikte, Pipeline-Bedarf, Re-Extraktion, geaenderte Quellen).
 */
export function verbucheZeile(report: LibrarySyncReport, zeile: SourceSyncReportRow): void {
  let ausgewaehlt = 0
  for (const op of zeile.operations) {
    bump(report.planned, op.type)
    if (op.selected) {
      bump(report.selected, op.type)
      ausgewaehlt++
    }
    if (op.type === 'conflict') report.conflicts++
    if (op.type === 'needs-pipeline') report.needsPipeline++
  }
  if (zeile.transcriptStatus === 'needs-reextract') report.needsReextract++
  if (ausgewaehlt > 0) report.changed++
}

/**
 * Verbucht die Ergebnisse einer Ausfuehrung (nur repair-Modus). Report-only-
 * Operationen zaehlen nicht als ausgefuehrt — sie beschreiben nur.
 */
export function verbucheAusfuehrung(report: LibrarySyncReport, outcomes: readonly OperationOutcome[]): void {
  for (const outcome of outcomes) {
    if (REPORT_ONLY_OPERATION_TYPES.has(outcome.operation.type)) continue
    if (outcome.executed) bump(report.executed, outcome.operation.type)
    else {
      bump(report.failed, outcome.operation.type)
      report.errors++
    }
  }
}
