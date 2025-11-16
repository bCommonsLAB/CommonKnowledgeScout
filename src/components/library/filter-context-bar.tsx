'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Filter, X, MessageCircle, ArrowRight } from 'lucide-react'
import { useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { useTranslation } from '@/lib/i18n/hooks'

interface FilterContextBarProps {
  docCount: number
  onOpenFilters: () => void
  onClear: () => void
  hideFilterButton?: boolean // Optional: Versteckt den Filter-Button (z.B. wenn Panel permanent sichtbar ist)
  facetDefs?: Array<{ metaKey: string; label: string }> // Optional: Facetten-Definitionen für Label-Lookup
  ctaLabel?: string // Optional: Label für CTA-Button
  onCta?: () => void // Optional: Callback für CTA-Button
  tooltip?: string // Optional: Tooltip für CTA-Button
}

/**
 * Filter-Kontext-Bar: Zeigt aktive Filter und Dokumentenanzahl
 * Wird oben in Gallery und Story-Modus angezeigt
 * 
 * Zeigt Facetten-Filter (Track, Jahr, etc.) und shortTitle-Filter an.
 */
export function FilterContextBar({ docCount, onOpenFilters, onClear, hideFilterButton = false, facetDefs = [], ctaLabel, onCta, tooltip }: FilterContextBarProps) {
  const filters = useAtomValue(galleryFiltersAtom)
  const { t } = useTranslation()
  
  // Erstelle eine Map für schnelles Label-Lookup
  const labelMap = new Map<string, string>()
  facetDefs.forEach(def => {
    labelMap.set(def.metaKey, def.label || def.metaKey)
  })
  
  // Extrahiere alle gesetzten Filter-Werte (Facetten-Filter und shortTitle-Filter)
  const activeFilters: Array<{ key: string; value: string }> = []
  Object.entries(filters as Record<string, string[] | undefined>).forEach(([key, values]) => {
    if (Array.isArray(values) && values.length > 0) {
      // Verwende Label aus facetDefs, falls verfügbar, sonst metaKey
      // Für shortTitle verwenden wir ein benutzerfreundliches Label
      const displayKey = key === 'shortTitle' 
        ? t('gallery.document') 
        : (labelMap.get(key) || key)
      values.forEach(value => {
        activeFilters.push({ key: displayKey, value: String(value) })
      })
    }
  })

  const hasActiveFilters = activeFilters.length > 0

  return (
    <div className="border-b py-2 flex flex-col gap-2">
      {/* Filter-Bar mit Icons, Badges und Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Titel mit Dokumentenanzahl */}
        <h2 className="text-lg font-semibold">
          {t('gallery.answersGeneratedFromSources', { 
            count: docCount,
            sourceLabel: docCount === 1 ? t('gallery.source') : t('gallery.sources')
          })}
        </h2>
        {!hideFilterButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenFilters}
          className="h-7 px-2 lg:px-2 shrink-0"
        >
          <Filter className="h-3 w-3 lg:mr-1" />
          <span className="hidden lg:inline">{t('gallery.filter')}</span>
        </Button>
      )}

      {/* Gefiltert-Badge - nur anzeigen wenn Filter aktiv sind */}
      {hasActiveFilters && (
        <div className="text-sm text-muted-foreground shrink-0">
          {t('gallery.filtered')}:
        </div>
      )}

      {/* Gesetzte Filter als Badges */}
      {hasActiveFilters && (
        <>
          {activeFilters.map((filter, index) => (
            <Badge
              key={`${filter.key}-${filter.value}-${index}`}
              variant="secondary"
              className="text-xs shrink-0"
            >
              {filter.key}: {filter.value}
            </Badge>
          ))}
        </>
      )}

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

      {/* CTA-Button - immer rechtsbündig */}
      {ctaLabel && onCta && (
        <div className="flex items-center shrink-0 ml-auto">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onCta}
                  className="flex items-center gap-1.5 sm:gap-2 font-semibold shadow-md hover:shadow-lg transition-all flex-shrink-0 px-2 sm:px-4 text-xs sm:text-sm h-7 sm:h-8"
                >
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>{ctaLabel}</span>
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              {tooltip && (
                <TooltipContent>
                  <p>{tooltip}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
      </div>
    </div>
  )
}

