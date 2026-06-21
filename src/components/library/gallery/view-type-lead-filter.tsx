"use client"

import * as React from "react"
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
 *
 * Layout: optisch an die uebrigen Facetten (`FacetGroup`) angeglichen — gleiche
 * Karte (Rahmen + Verlauf), gleicher Kopf (Label + „Zuruecksetzen") und gleiche
 * Auswahl-Liste. Anders als die Mehrfach-Facetten ist dies aber ein EINFACH-
 * Filter (Radio-Semantik): genau ein aktiver Typ oder „Alle".
 */
export function ViewTypeLeadFilter({ viewTypes, selected, onSelect }: ViewTypeLeadFilterProps) {
  if (!Array.isArray(viewTypes) || viewTypes.length < 2) return null

  // Zeilen-Modell: „Alle" (null) zuerst, danach die vorhandenen Typen.
  const rows: Array<{ key: string; label: string; value: string | null }> = [
    { key: "__all__", label: "Alle", value: null },
    ...viewTypes.map((vt) => ({ key: vt, label: labelFor(vt), value: vt })),
  ]

  return (
    <div
      className="border rounded p-2 bg-gradient-to-br from-blue-50/30 to-cyan-50/30 dark:from-blue-950/10 dark:to-cyan-950/10"
      data-testid="view-type-lead-filter"
    >
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <div className="text-sm font-medium truncate flex-1 min-w-0">Inhaltstyp</div>
        {/* „Zuruecksetzen" nur zeigen, wenn ein Typ aktiv ist (sonst redundant zu „Alle"). */}
        {selected !== null && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:underline shrink-0"
            onClick={() => onSelect(null)}
          >
            Zurücksetzen
          </button>
        )}
      </div>
      <div className="max-h-40 overflow-auto space-y-1">
        {rows.map((row) => {
          const active = selected === row.value
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => onSelect(row.value)}
              aria-pressed={active}
              className={`w-full flex items-center rounded px-2 py-1 text-left text-sm min-w-0 ${
                active ? "bg-primary/10 font-medium" : "hover:bg-muted"
              }`}
            >
              <span className="truncate min-w-0">{row.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ViewTypeLeadFilter
