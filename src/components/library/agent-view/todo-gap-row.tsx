'use client'

/**
 * @fileoverview Eine Befund-Zeile der Todo-Listen (auswaehlbar).
 *
 * @description
 * Zeigt Label, Klartext und Pfad eines Befunds; die Checkbox nimmt ihn in
 * den Auftrag auf (F3). Reine Anzeige — keine Aktion am Bestand. Seit W4
 * oeffnet ein Klick auf den Pfad das Werkbank-Detail des Ordners (§F6).
 *
 * @module components/library/agent-view
 */

import { Checkbox } from '@ks/ui'
import { gapLabel } from '@/lib/agent-view/labels'
import type { CoverageGap } from '@/lib/agent-view/types'

export interface TodoGapRowProps {
  gap: CoverageGap
  /** Stabile Kennung innerhalb des Reports (Index in `report.gaps`). */
  gapKey: number
  selected: boolean
  onToggle: (gapKey: number, selected: boolean) => void
  /** Oeffnet das Werkbank-Detail zum Ordner des Befunds (W4, §F6). */
  onOpenVorhaben: (folderId: string) => void
}

export function TodoGapRow({ gap, gapKey, selected, onToggle, onOpenVorhaben }: TodoGapRowProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs hover:bg-muted/40">
      <Checkbox
        checked={selected}
        onCheckedChange={(checked) => onToggle(gapKey, checked === true)}
        className="mt-0.5"
        aria-label={`${gapLabel(gap.type)} aufnehmen`}
      />
      <span className="min-w-0">
        <span className="font-medium">{gapLabel(gap.type)}</span>
        <span className="text-muted-foreground"> — {gap.message}</span>
        <button
          type="button"
          onClick={(event) => {
            // Nicht die Checkbox des umgebenden Labels toggeln — nur navigieren.
            event.preventDefault()
            onOpenVorhaben(gap.folderId)
          }}
          title="Im Werkbank-Detail oeffnen"
          className="block max-w-full truncate text-left text-muted-foreground/80 underline-offset-2 hover:underline"
        >
          {gap.path || '(Archiv-Wurzel)'}
        </button>
      </span>
    </label>
  )
}
