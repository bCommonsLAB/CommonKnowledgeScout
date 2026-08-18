'use client'

/**
 * @fileoverview Eine Befund-Zeile der Todo-Listen (auswaehlbar).
 *
 * @description
 * Zeigt Label, Klartext und Pfad eines Befunds; die Checkbox nimmt ihn in
 * den Auftrag auf (F3). Reine Anzeige — keine Aktion am Bestand.
 *
 * @module components/library/agent-view
 */

import { Checkbox } from '@/components/ui/checkbox'
import { gapLabel } from '@/lib/agent-view/labels'
import type { CoverageGap } from '@/lib/agent-view/types'

export interface TodoGapRowProps {
  gap: CoverageGap
  /** Stabile Kennung innerhalb des Reports (Index in `report.gaps`). */
  gapKey: number
  selected: boolean
  onToggle: (gapKey: number, selected: boolean) => void
}

export function TodoGapRow({ gap, gapKey, selected, onToggle }: TodoGapRowProps) {
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
        <span className="block truncate text-muted-foreground/80" title={gap.path || '(Wurzel)'}>
          {gap.path || '(Archiv-Wurzel)'}
        </span>
      </span>
    </label>
  )
}
