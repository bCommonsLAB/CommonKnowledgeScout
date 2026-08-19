/**
 * @fileoverview Kompakte Sync-Engine-Sicht fuer MCP-Agenten (Welle 5).
 *
 * @description
 * Verdichtet den `LibrarySyncReport` (check UND repair) fuer die
 * Werkzeug-Ausgabe: Zaehler vollstaendig, Detail-Zeilen nur dort, wo etwas
 * ansteht (Operationen, Notizen oder Fehler), gekappt an einem expliziten
 * Budget — Kappung wird ausgewiesen, nie still. Reine Funktion.
 *
 * @module mcp
 */

import type { LibrarySyncReport, SourceSyncReportRow } from '@/lib/shadow-twin/sync-engine/report-types'

/** Standard-Budget der Detail-Zeilen (per Argument erhoehbar). */
export const DEFAULT_MAX_ROWS = 50

function hasSubstance(row: SourceSyncReportRow): boolean {
  return row.operations.length > 0 || row.notes.length > 0 || Boolean(row.error)
}

function compactRow(row: SourceSyncReportRow) {
  return {
    sourceName: row.sourceName,
    sourceId: row.sourceId,
    transcriptStatus: row.transcriptStatus,
    operationen: row.operations.map((op) => ({
      type: op.type,
      fileName: op.fileName,
      ...(op.newFileName ? { newFileName: op.newFileName } : {}),
      ...(op.note ? { note: op.note } : {}),
      imPreset: op.selected,
      ...(op.executed !== undefined ? { ausgefuehrt: op.executed } : {}),
      ...(op.error ? { error: op.error } : {}),
    })),
    ...(row.notes.length > 0 ? { notizen: row.notes } : {}),
    ...(row.error ? { error: row.error } : {}),
  }
}

/** Kompakte Agenten-Sicht auf einen Engine-Lauf. */
export function summarizeSyncReport(report: LibrarySyncReport, opts: { maxRows?: number } = {}) {
  const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS
  const relevant = report.sources.filter(hasSubstance)

  return {
    libraryId: report.libraryId,
    modus: report.mode,
    preset: report.preset,
    hinweis:
      report.mode === 'check'
        ? 'check-Modus: NICHTS wurde geschrieben — Zeilen zeigen den Plan.'
        : 'repair-Modus: nur die vom Preset erlaubten Operationen wurden ausgefuehrt.',
    zaehler: {
      quellen: report.totalSources,
      gescannteDateien: report.scannedFiles ?? null,
      uebersprungenOhneDoc: report.skippedWithoutDoc,
      uebersprungenAusgeschlossen: report.skippedExcluded ?? 0,
      geaendert: report.changed,
      konflikte: report.conflicts,
      pipelineNoetig: report.needsPipeline,
      reextraktionNoetig: report.needsReextract,
      fehler: report.errors,
    },
    operationen: {
      geplant: report.planned,
      imPreset: report.selected,
      ausgefuehrt: report.executed,
      fehlgeschlagen: report.failed,
    },
    zeilen: relevant.slice(0, maxRows).map(compactRow),
    zeilenAnzahl: relevant.length,
    zeilenGekappt: relevant.length > maxRows,
    /** true = schon der Engine-Report selbst enthielt nicht alle Quellen. */
    engineReportGekappt: report.sourcesTruncated,
  }
}
