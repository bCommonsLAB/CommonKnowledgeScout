/**
 * @fileoverview Report-Typen der Sync-Engine (check- UND repair-Modus).
 *
 * @description
 * EIN Report-Format fuer beide Modi: `check` liefert dieselben Zeilen wie
 * `repair`, nur ohne `executed` — Vorschau und Reparatur koennen sich damit
 * nie widersprechen (Design §3). Operationen im Report tragen KEIN Markdown
 * (Report bleibt schlank); `selected` markiert, was das Preset ausfuehrt.
 *
 * @module shadow-twin/sync-engine
 */

import type { ReconcileStatus } from '@/lib/shadow-twin/reconcile-plan'
import type { SyncPreset } from '@/lib/shadow-twin/sync-plan/allowed-ops'
import type { SyncOperationKind, SyncOperationType } from '@/lib/shadow-twin/sync-plan/types'

export type SyncMode = 'check' | 'repair'

/** Eine geplante Operation im Report (ohne Markdown-Inhalt). */
export interface SourceOperationReport {
  type: SyncOperationType
  kind: SyncOperationKind
  targetLanguage: string
  templateName?: string
  fileName: string
  overwrite?: boolean
  count?: number
  note?: string
  /** Vom Preset zur Ausfuehrung ausgewaehlt (Report-only-Ops: immer false). */
  selected: boolean
  /** Nur repair-Modus: tatsaechlich ausgefuehrt. */
  executed?: boolean
  error?: string
}

export interface SourceSyncReportRow {
  sourceId: string
  sourceName: string
  transcriptStatus: ReconcileStatus
  /** Gewinner-Transkript (per-Datei-Dialog: Name, Herkunft, Seitenzahl). */
  winnerName: string | null
  winnerOrigin: 'storage' | 'mongo' | null
  winnerPages: number
  operations: SourceOperationReport[]
  notes: string[]
  /** Quell-Ebene-Fehler (z.B. Twin-Ordner nicht lesbar → Quelle uebersprungen). */
  error?: string
}

/** Zaehler je Operationsklasse. */
export type OperationCounts = Partial<Record<SyncOperationType, number>>

export interface LibrarySyncReport {
  libraryId: string
  mode: SyncMode
  preset: SyncPreset
  /** Verarbeitete Quellen (mit Shadow-Twin-Dokument ODER adoptierbaren Artefakten). */
  totalSources: number
  /** Gescannte Storage-Dateien (folder- und Library-Scope). */
  scannedFiles?: number
  /** Dateien ohne Shadow-Twin-Dokument UND ohne adoptierbare Artefakte (Welle 5a). */
  skippedWithoutDoc: number
  /** Quellen mit mindestens einer ausgewaehlten Operation. */
  changed: number
  conflicts: number
  needsPipeline: number
  needsReextract: number
  planned: OperationCounts
  selected: OperationCounts
  executed: OperationCounts
  failed: OperationCounts
  /** Summe fehlgeschlagener Operationen + Quell-Fehler. */
  errors: number
  sources: SourceSyncReportRow[]
  sourcesTruncated: boolean
}
