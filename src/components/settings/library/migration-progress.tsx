"use client"

/**
 * @fileoverview MigrationProgress — Live-Fortschritt eines Migrations-Laufs.
 *
 * @description
 * Zeigt während eines laufenden "Aus Dateisystem laden"-Vorgangs den Fortschritt
 * (x von y Quellen, importierte Artefakte) als Balken und bietet einen Abbrechen-Button.
 * Die Daten stammen aus dem Polling der Run-Status-Route (use-shadow-twin-migration).
 */

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Loader2, XCircle } from "lucide-react"
import type { MigrationProgress as MigrationProgressData } from "./hooks/use-shadow-twin-migration"

interface MigrationProgressProps {
  running: boolean
  progress: MigrationProgressData | null
  isCancelling: boolean
  onCancel: () => void
}

export function MigrationProgress({ running, progress, isCancelling, onCancel }: MigrationProgressProps) {
  // Nur anzeigen, wenn ein Lauf aktiv ist oder gerade Fortschritt vorliegt.
  if (!running && !progress) return null

  const scanned = progress?.scanned ?? 0
  const total = progress?.total ?? 0
  // Prozent nur sinnvoll, wenn total bekannt ist (scan_done lief bereits).
  const percent = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0
  const upserted = progress?.upserted ?? 0

  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span className="font-medium">
            {total > 0 ? `${scanned} von ${total} Quellen` : "Scanne Verzeichnis…"}
          </span>
          <span className="text-muted-foreground text-xs">
            · {upserted} Artefakte importiert
          </span>
        </div>
        {running ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onCancel}
            disabled={isCancelling}
          >
            <XCircle className="h-4 w-4 mr-1.5" />
            {isCancelling ? "Wird abgebrochen…" : "Abbrechen"}
          </Button>
        ) : null}
      </div>
      <Progress value={percent} />
    </div>
  )
}
