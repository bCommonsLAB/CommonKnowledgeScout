'use client'

/**
 * @fileoverview Klartext-Ansicht des Sync-Engine-Reports (Pruefen/Reparieren).
 *
 * @description
 * Zeigt den EINEN Report der Sync-Engine (check UND repair) in einfacher
 * Sprache. Die UI kennt nur die API-Antwort — keine Storage-Interna
 * (storage-abstraction.mdc).
 */

import * as React from 'react'

/** Teilmenge des LibrarySyncReport, die die Settings-UI anzeigt. */
export interface SyncReportView {
  mode: 'check' | 'repair'
  preset: string
  totalSources: number
  scannedFiles?: number
  skippedWithoutDoc: number
  changed: number
  conflicts: number
  needsPipeline: number
  needsReextract: number
  selected: Record<string, number>
  executed: Record<string, number>
  failed: Record<string, number>
  errors: number
}

/** Summe der Zaehler ausgewaehlter Operationsklassen. */
function sum(counts: Record<string, number>, types: string[]): number {
  return types.reduce((acc, type) => acc + (counts[type] ?? 0), 0)
}

const DELETE_TYPES = ['delete-inferior-variant', 'delete-dead-page-md']
const MIRROR_TYPES = ['write-canonical-transcript', 'mirror-artifact-to-storage', 'mirror-image-to-storage']

export function ShadowTwinSyncReportView({ report }: { report: SyncReportView }) {
  const isRepair = report.mode === 'repair'
  // check: was das Preset tun WUERDE; repair: was wirklich getan wurde.
  const counts = isRepair ? report.executed : report.selected
  const deletions = sum(counts, DELETE_TYPES)
  const mirrored = sum(counts, MIRROR_TYPES)
  const adopted = sum(counts, ['update-mongo-transcript', 'update-mongo-transformation'])
  const images = counts['register-image-fragments'] ?? 0

  const rows: Array<{ label: string; value: number; tone?: 'ok' | 'warn' | 'error' }> = [
    // Bei Ordner-Scope: gescannte Dateien zeigen (sonst wirkt „0 geprüft" falsch,
    // wenn der Ordner nur Dateien ohne Datenbank-Eintrag enthaelt).
    { label: 'Dateien geprüft', value: report.scannedFiles ?? report.totalSources },
    { label: 'Ohne Datenbank-Eintrag (übersprungen)', value: report.skippedWithoutDoc },
    { label: isRepair ? 'Repariert' : 'Würde reparieren', value: report.changed },
    { label: isRepair ? 'In Datenbank übernommen' : 'Würde in Datenbank übernehmen', value: adopted },
    { label: isRepair ? 'Ins Dateisystem geschrieben' : 'Würde ins Dateisystem schreiben', value: mirrored },
    { label: isRepair ? 'Aufgeräumt (Dateien gelöscht)' : 'Würde aufräumen (Dateien löschen)', value: deletions },
    { label: isRepair ? 'Bilder registriert' : 'Bilder registrierbar', value: images },
    { label: 'Uneindeutig (übersprungen)', value: report.conflicts, tone: 'warn' },
    { label: 'Neu-Verarbeitung nötig (Pipeline)', value: report.needsPipeline + report.needsReextract, tone: 'warn' },
    { label: 'Fehler', value: report.errors, tone: 'error' },
  ]

  return (
    <div className="rounded-md border p-3 text-sm space-y-1">
      <div className="text-xs font-medium text-muted-foreground">
        {isRepair ? 'Ergebnis der Reparatur' : 'Ergebnis der Prüfung (nichts verändert)'}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        {rows
          .filter((row) => row.value > 0 || row.label === 'Dateien geprüft')
          .map((row) => (
            <span key={row.label}>
              {row.label}:{' '}
              <strong
                className={
                  row.tone === 'error' ? 'text-red-600' : row.tone === 'warn' ? 'text-amber-600' : 'text-foreground'
                }
              >
                {row.value}
              </strong>
            </span>
          ))}
      </div>
      {report.changed === 0 && report.errors === 0 && report.conflicts === 0 && (
        <div className="text-xs text-muted-foreground">Alles in Ordnung — nichts zu tun.</div>
      )}
    </div>
  )
}
