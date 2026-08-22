/**
 * @fileoverview Kompakte Sync-Engine-Sicht fuer MCP-Agenten (Welle 5).
 *
 * @description
 * Verdichtet den `LibrarySyncReport` (check UND repair) fuer die
 * Werkzeug-Ausgabe: Zaehler vollstaendig, Detail-Zeilen nur dort, wo etwas
 * ansteht (Operationen, Notizen oder Fehler), gekappt an einem expliziten
 * Budget — Kappung wird ausgewiesen, nie still. Reine Funktion.
 *
 * Abend-Befund 22.08. (B1): Eine PDF-Familie meldete 17 gleichartige
 * `delete-dead-page-md` einzeln — bei 7 Familien 92 Zeilen fuer EINE
 * Aussage. Gleichartige Operationen je Quelle (gleicher Typ, gleiche
 * Preset-/Ausfuehrungslage, ohne Notiz/Fehler/Umbenennung) werden ab
 * `GROUP_THRESHOLD` zu EINER Gruppe verdichtet: Anzahl + Beispiel-Dateien,
 * als `verdichtet: true` ausgewiesen. Operationen mit Notiz, Fehler oder
 * Ziel-Dateiname bleiben immer einzeln sichtbar.
 *
 * @module mcp
 */

import type {
  LibrarySyncReport,
  SourceOperationReport,
  SourceSyncReportRow,
} from '@/lib/shadow-twin/sync-engine/report-types'

/** Standard-Budget der Detail-Zeilen (per Argument erhoehbar). */
export const DEFAULT_MAX_ROWS = 50
/** Ab dieser Anzahl gleichartiger Operationen je Quelle wird verdichtet. */
export const GROUP_THRESHOLD = 4
/** Beispiel-Dateinamen je verdichteter Gruppe. */
const GROUP_SAMPLE = 3

function hasSubstance(row: SourceSyncReportRow): boolean {
  return row.operations.length > 0 || row.notes.length > 0 || Boolean(row.error)
}

function compactOperation(op: SourceOperationReport) {
  return {
    type: op.type,
    fileName: op.fileName,
    ...(op.newFileName ? { newFileName: op.newFileName } : {}),
    ...(op.note ? { note: op.note } : {}),
    imPreset: op.selected,
    ...(op.executed !== undefined ? { ausgefuehrt: op.executed } : {}),
    ...(op.error ? { error: op.error } : {}),
  }
}

/** Gruppe gleichartiger Operationen (siehe Datei-Kommentar). */
function groupedOperation(members: SourceOperationReport[]) {
  const first = members[0]
  return {
    type: first.type,
    imPreset: first.selected,
    ...(first.executed !== undefined ? { ausgefuehrt: first.executed } : {}),
    verdichtet: true as const,
    anzahl: members.length,
    dateien: members.slice(0, GROUP_SAMPLE).map((op) => op.fileName),
    weitereDateien: members.length - GROUP_SAMPLE,
  }
}

type CompactOperation = ReturnType<typeof compactOperation>
type GroupedOperation = ReturnType<typeof groupedOperation>
/** Eine Operation in der Agenten-Sicht: einzeln oder verdichtete Gruppe. */
export type AgentOperation = CompactOperation | GroupedOperation

/** Nur „stumme" Operationen sind gruppierbar — alles mit Aussage bleibt einzeln. */
function isGroupable(op: SourceOperationReport): boolean {
  return !op.note && !op.error && !op.newFileName
}

/** Verdichtet die Operationen EINER Quelle; Reihenfolge = erstes Auftreten. */
export function compactOperations(operations: readonly SourceOperationReport[]): AgentOperation[] {
  const groups = new Map<string, SourceOperationReport[]>()
  const order: Array<{ key: string } | { single: SourceOperationReport }> = []
  for (const op of operations) {
    if (!isGroupable(op)) {
      order.push({ single: op })
      continue
    }
    const key = `${op.type}|${op.selected}|${String(op.executed)}`
    const members = groups.get(key)
    if (members) {
      members.push(op)
    } else {
      groups.set(key, [op])
      order.push({ key })
    }
  }
  return order.flatMap((entry): AgentOperation[] => {
    if ('single' in entry) return [compactOperation(entry.single)]
    const members = groups.get(entry.key) ?? []
    return members.length >= GROUP_THRESHOLD ? [groupedOperation(members)] : members.map(compactOperation)
  })
}

function compactRow(row: SourceSyncReportRow) {
  return {
    sourceName: row.sourceName,
    sourceId: row.sourceId,
    transcriptStatus: row.transcriptStatus,
    operationen: compactOperations(row.operations),
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
    /** Gleichartige Operationen je Quelle sind ab GROUP_THRESHOLD als Gruppe ausgewiesen. */
    verdichtungAb: GROUP_THRESHOLD,
  }
}
