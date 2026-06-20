"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { VIEW_TYPE_LABELS } from "@/lib/detail-view-types/view-type-display"
import type { DetailViewType } from "@/lib/detail-view-types/registry"

interface ViewTypeLeadFilterProps {
  /** Vorhandene Inhaltstypen der Library (aus der Facetten-API). */
  viewTypes: string[]
  /** Aktuell gewaehlter Typ oder null (= „Alle"). */
  selected: string | null
  /** Wahl-Callback: `null` = „Alle" (Typ-Filter entfernen). */
  onSelect: (viewType: string | null) => void
}

/** Lesbares Label fuer einen Typ (Fallback: der Roh-Schluessel). */
function labelFor(viewType: string): string {
  return VIEW_TYPE_LABELS[viewType as DetailViewType] ?? viewType
}

/**
 * Inhaltstyp als ERSTER Filter (Plan 1 · A4a). Erscheint nur in GEMISCHTEN
 * Libraries (>= 2 Typen). „Alle" entfernt den Typ-Filter; ein gewaehlter Typ
 * scoped Facetten + Liste streng auf diesen Typ (Server-seitig).
 */
export function ViewTypeLeadFilter({ viewTypes, selected, onSelect }: ViewTypeLeadFilterProps) {
  if (!Array.isArray(viewTypes) || viewTypes.length < 2) return null

  return (
    <div className="mb-3" data-testid="view-type-lead-filter">
      <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
        Inhaltstyp
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={selected === null ? "default" : "outline"}
          onClick={() => onSelect(null)}
        >
          Alle
        </Button>
        {viewTypes.map((vt) => (
          <Button
            key={vt}
            type="button"
            size="sm"
            variant={selected === vt ? "default" : "outline"}
            onClick={() => onSelect(vt)}
          >
            {labelFor(vt)}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default ViewTypeLeadFilter
