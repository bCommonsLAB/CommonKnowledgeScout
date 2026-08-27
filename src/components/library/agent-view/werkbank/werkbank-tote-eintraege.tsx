'use client'

/**
 * @fileoverview Tote Arbeitslisten-Eintraege (F7, Welle W6).
 *
 * @description
 * Mitglieder, die der letzte Scan nicht enthaelt (Ordner geloescht,
 * verschoben oder Teilbaum-Report), erscheinen als „nicht im letzten
 * Scan"-Zeile mit dem gemerkten `pathSnapshot` und sind dort entfernbar —
 * angezeigt, nie still verworfen (F7; Kreuztest der Buecher).
 *
 * @module components/library/agent-view
 */

import { X } from 'lucide-react'
import { Button } from '@ks/ui'
import type { WorklistMitglied } from '@/lib/agent-view/worklist-fortschritt'

export function WerkbankToteEintraege({
  tote,
  onEntfernen,
}: {
  tote: readonly WorklistMitglied[]
  onEntfernen: (folderId: string) => void
}) {
  if (tote.length === 0) return null
  return (
    <div className="space-y-1 border-b px-2 py-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Nicht im letzten Scan ({tote.length})
      </p>
      {tote.map((eintrag) => (
        <div key={eintrag.folderId} className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate" title={eintrag.pathSnapshot || eintrag.name}>
            {eintrag.name}
            <span className="text-muted-foreground/70"> — {eintrag.pathSnapshot || '(Pfad unbekannt)'}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1"
            aria-label={`${eintrag.name} aus der Liste entfernen`}
            onClick={() => onEntfernen(eintrag.folderId)}
          >
            <X className="h-3 w-3" aria-hidden />
          </Button>
        </div>
      ))}
    </div>
  )
}
