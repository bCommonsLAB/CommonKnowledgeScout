'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Filter, X } from 'lucide-react'
import { useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { useTranslation } from '@/lib/i18n/hooks'

interface FilterContextBarProps {
  docCount: number
  onOpenFilters: () => void
  onClear: () => void
  showReferenceLegend?: boolean // Optional: Zeigt an, ob Quellenverzeichnis-Modus aktiv ist
  hideFilterButton?: boolean // Optional: Versteckt den Filter-Button (z.B. wenn Panel permanent sichtbar ist)
  facetDefs?: Array<{ metaKey: string; label: string }> // Optional: Facetten-Definitionen für Label-Lookup
}

/**
 * Filter-Kontext-Bar: Zeigt aktive Filter und Dokumentenanzahl
 * Wird oben in Gallery und Story-Modus angezeigt
 */
export function FilterContextBar({ docCount, onOpenFilters, onClear, showReferenceLegend = false, hideFilterButton = false, facetDefs = [] }: FilterContextBarProps) {
  const filters = useAtomValue(galleryFiltersAtom)
  const { t } = useTranslation()
  
  // Erstelle eine Map für schnelles Label-Lookup
  const labelMap = new Map<string, string>()
  facetDefs.forEach(def => {
    labelMap.set(def.metaKey, def.label || def.metaKey)
  })
  
  // Extrahiere alle gesetzten Filter-Werte
  const activeFilters: Array<{ key: string; value: string }> = []
  Object.entries(filters as Record<string, string[] | undefined>).forEach(([key, values]) => {
    if (Array.isArray(values) && values.length > 0) {
      // fileId-Filter nur anzeigen, wenn Quellenverzeichnis-Modus aktiv ist
      if (key === 'fileId') {
        if (showReferenceLegend) {
          // Zeige Anzahl der referenzierten Dokumente (nur einmal hinzufügen)
          activeFilters.push({ key: t('gallery.references'), value: `${values.length} ${values.length === 1 ? t('gallery.document') : t('gallery.documents')}` })
        }
        // Sonst nicht anzeigen (nur für interne Filterung)
      } else {
        // Normale Facetten-Filter: alle Werte hinzufügen
        // Verwende Label aus facetDefs, falls verfügbar, sonst metaKey
        const displayKey = labelMap.get(key) || key
        values.forEach(value => {
          activeFilters.push({ key: displayKey, value: String(value) })
        })
      }
    }
  })

  const hasActiveFilters = activeFilters.length > 0

  return (
    <div className="border-b bg-muted/30 px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Filter-Icon - nur anzeigen wenn hideFilterButton nicht gesetzt */}
        {!hideFilterButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenFilters}
            className="h-7 px-2 shrink-0"
          >
            <Filter className="h-3 w-3 mr-1" />
            {t('gallery.filter')}
          </Button>
        )}

        {/* Dokumentenanzahl */}
        <div className="text-sm text-muted-foreground shrink-0">
          {docCount} {docCount === 1 ? t('gallery.document') : t('gallery.documents')}
          {hasActiveFilters && ` ${t('gallery.filtered')}`}
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
          {t('gallery.reset')}
        </Button>
      )}
    </div>
  )
}

