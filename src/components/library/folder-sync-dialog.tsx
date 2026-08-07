'use client'

/**
 * @fileoverview Zweistufiger Ordner-Abgleich (Explorer-Toolbar, Welle 4 §6).
 *
 * @description
 * Zeigt den Pruef-Report der Sync-Engine (mode=check) fuer das aktuelle
 * Verzeichnis und laesst „Reparieren" erst nach Sichtung bestaetigen —
 * ersetzt den frueheren Direkt-Schreiblauf ohne Vorschau (sync-all).
 */

import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ShadowTwinSyncReportView, type SyncReportView } from '@/components/settings/shadow-twin-sync-report-view'

interface FolderSyncDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pruef-Report (mode=check) fuer den aktuellen Ordner. */
  report: SyncReportView | null
  /** Fuehrt denselben Plan als repair aus (Dialog schliesst, Toolbar-Icon spinnt). */
  onRepair: () => void
}

export function FolderSyncDialog({ open, onOpenChange, report, onRepair }: FolderSyncDialogProps) {
  const hasChanges = !!report && report.changed > 0
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Verzeichnis abgleichen</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              {report ? <ShadowTwinSyncReportView report={report} /> : <span>Keine Daten.</span>}
              {hasChanges && (
                <div className="text-muted-foreground">
                  „Reparieren“ führt genau diese Änderungen aus. Löschungen lassen sich
                  nicht rückgängig machen.
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Schließen</AlertDialogCancel>
          {hasChanges && <AlertDialogAction onClick={onRepair}>Reparieren</AlertDialogAction>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
