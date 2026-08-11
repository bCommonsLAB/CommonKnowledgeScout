/**
 * @fileoverview Preset-Filter: welche geplanten Operationen darf ein Lauf ausfuehren?
 *
 * @description
 * Der Plan (plan-source-sync.ts) ist config-agnostisch und listet ALLES, was
 * den deterministischen Zustand herstellen wuerde. Presets waehlen daraus die
 * ausfuehrbare Teilmenge — dieselbe Funktion filtert im `check`-Report
 * (Markierung „wird ausgefuehrt") und im `repair`-Lauf, damit Vorschau und
 * Reparatur nie auseinanderlaufen (Design §3/§6):
 *
 * - `repair` (Standard „Pruefen/Reparieren"): Mongo-Angleich, Bild-Registrierung,
 *   beide Loesch-Kategorien; Storage-Spiegel nur wenn `persistToFilesystem`.
 * - `export` („Ins Dateisystem exportieren", Disclosure): NUR Storage-Spiegel
 *   (Markdown + Bilder), unabhaengig von der Config — nie Mongo-Writes, nie Loeschen.
 * - `auto-sync` (stiller Abgleich beim Datei-Oeffnen): nur gefahrlose Operationen —
 *   Mongo-Uebernahme + fehlende Spiegel ergaenzen (kein Overwrite), nie Loeschen.
 *
 * Report-only-Operationen (conflict, needs-pipeline) sind in KEINEM Preset erlaubt.
 *
 * @module shadow-twin/sync-plan
 */

import { REPORT_ONLY_OPERATION_TYPES, type SyncOperation } from './types'

export type SyncPreset = 'repair' | 'export' | 'auto-sync'

export interface AllowedOpsContext {
  /** Library-Config: Storage-Spiegel wird gepflegt (`persistToFilesystem`). */
  persistToFilesystem: boolean
}

/** Entscheidet fuer EINE Operation, ob das Preset sie ausfuehren darf. */
export function isOperationAllowed(
  op: SyncOperation,
  preset: SyncPreset,
  ctx: AllowedOpsContext,
): boolean {
  if (REPORT_ONLY_OPERATION_TYPES.has(op.type)) return false

  switch (preset) {
    case 'repair':
      switch (op.type) {
        case 'update-mongo-transcript':
        case 'update-mongo-transformation':
        case 'register-image-fragments':
        case 'delete-inferior-variant':
        case 'delete-dead-page-md':
        // Welle 5a: Quellen ohne Mongo-Dokument aus dem Storage uebernehmen.
        case 'adopt-storage-only-source':
          return true
        case 'write-canonical-transcript':
        case 'mirror-artifact-to-storage':
        // Welle 5c: Namens-Migration (Rename/Split) schreibt Storage-Dateien —
        // nur mit gepflegtem Spiegel; export/auto-sync fuehren sie NIE aus.
        case 'migrate-legacy-artifact-name':
        case 'split-combined-artifact':
          return ctx.persistToFilesystem
        case 'mirror-image-to-storage':
          // Bilder-Spiegel ist Export-Sache (grosse Downloads), nicht Standard-Reparatur.
          return false
        default:
          return false
      }
    case 'export':
      switch (op.type) {
        case 'write-canonical-transcript':
        case 'mirror-artifact-to-storage':
        case 'mirror-image-to-storage':
          // Expliziter Export ignoriert persistToFilesystem bewusst (User will exportieren).
          return true
        case 'adopt-storage-only-source':
          // Export schreibt NIE nach Mongo — Adoption ist ein Mongo-Write.
          return false
        default:
          return false
      }
    case 'auto-sync':
      switch (op.type) {
        case 'update-mongo-transcript':
        case 'update-mongo-transformation':
          return true
        case 'adopt-storage-only-source':
          // Unbeaufsichtigt keine Voll-Adoption (Bild-Uploads nach Azure);
          // per-Datei-Adoption laeuft ueber das repair-Preset (Welle 5b:
          // reconstruct-Route + Lazy-Resolve im sourceIds-Scope).
          return false
        case 'write-canonical-transcript':
        case 'mirror-artifact-to-storage':
          // Unbeaufsichtigt nur Fehlendes ergaenzen — nie bestehende Dateien ersetzen.
          return ctx.persistToFilesystem && op.overwrite !== true
        default:
          return false
      }
    default: {
      // Erschoepfende Preset-Behandlung: unbekanntes Preset ist ein Programmierfehler.
      const exhaustive: never = preset
      throw new Error(`Unbekanntes Sync-Preset: ${String(exhaustive)}`)
    }
  }
}

/** Filtert die ausfuehrbare Teilmenge eines Plans (Reihenfolge bleibt erhalten). */
export function filterAllowedOperations(
  operations: ReadonlyArray<SyncOperation>,
  preset: SyncPreset,
  ctx: AllowedOpsContext,
): SyncOperation[] {
  return operations.filter((op) => isOperationAllowed(op, preset, ctx))
}
