'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Filter, X } from 'lucide-react'
import { useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'

interface FilterContextBarProps {
  docCount: number
  onOpenFilters: () => void
  onClear: () => void
  showReferenceLegend?: boolean // Optional: Zeigt an, ob Legenden-Modus aktiv ist
}

/**
 * Filter-Kontext-Bar: Zeigt aktive Filter und Dokumentenanzahl
 * Wird oben in Gallery und Story-Modus angezeigt
 */
export function FilterContextBar({ docCount, onOpenFilters, onClear, showReferenceLegend = false }: FilterContextBarProps) {
  const filters = useAtomValue(galleryFiltersAtom)
  
  // Extrahiere alle gesetzten Filter-Werte
  const activeFilters: Array<{ key: string; value: string }> = []
  Object.entries(filters as Record<string, string[] | undefined>).forEach(([key, values]) => {
    if (Array.isArray(values) && values.length > 0) {
      // fileId-Filter nur anzeigen, wenn Legenden-Modus aktiv ist
      if (key === 'fileId') {
        if (showReferenceLegend) {
          // Zeige Anzahl der referenzierten Dokumente (nur einmal hinzufügen)
          activeFilters.push({ key: 'Referenzen', value: `${values.length} ${values.length === 1 ? 'Dokument' : 'Dokumente'}` })
        }
        // Sonst nicht anzeigen (nur für interne Filterung)
      } else {
        // Normale Facetten-Filter: alle Werte hinzufügen
        values.forEach(value => {
          activeFilters.push({ key, value: String(value) })
        })
      }
    }
  })

  const hasActiveFilters = activeFilters.length > 0

  return (
    <div className="border-b bg-muted/30 px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Filter-Icon */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenFilters}
          className="h-7 px-2 shrink-0"
        >
          <Filter className="h-3 w-3 mr-1" />
          Filter
        </Button>

        {/* Dokumentenanzahl */}
        <div className="text-sm text-muted-foreground shrink-0">
          {docCount} {docCount === 1 ? 'Dokument' : 'Dokumente'}
          {hasActiveFilters && ' gefiltert'}
        </div>

        {/* Gesetzte Filter als Badges */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1 flex-wrap">
            {activeFilters.map((filter, index) => (
              <Badge
                key={`${filter.key}-${filter.value}-${index}`}
                variant="secondary"
                className="text-xs"
              >
                {filter.key}: {filter.value}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Button zum Zurücksetzen */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 px-2 shrink-0"
        >
          <X className="h-3 w-3 mr-1" />
          Zurücksetzen
        </Button>
      )}
    </div>
  )
}

