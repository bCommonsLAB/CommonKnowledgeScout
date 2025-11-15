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
  showReferenceLegend?: boolean // Optional: Zeigt an, ob Quellenverzeichnis-Modus aktiv ist
  hideFilterButton?: boolean // Optional: Versteckt den Filter-Button (z.B. wenn Panel permanent sichtbar ist)
  facetDefs?: Array<{ metaKey: string; label: string }> // Optional: Facetten-Definitionen für Label-Lookup
  ctaLabel?: string // Optional: Label für CTA-Button
  onCta?: () => void // Optional: Callback für CTA-Button
  tooltip?: string // Optional: Tooltip für CTA-Button
  docs?: Array<{ fileId?: string; id?: string; title?: string; shortTitle?: string }> // Optional: Dokumentenliste für fileId-Filter-Anzeige
}

/**
 * Filter-Kontext-Bar: Zeigt aktive Filter und Dokumentenanzahl
 * Wird oben in Gallery und Story-Modus angezeigt
 */
export function FilterContextBar({ docCount, onOpenFilters, onClear, showReferenceLegend = false, hideFilterButton = false, facetDefs = [], ctaLabel, onCta, tooltip, docs = [] }: FilterContextBarProps) {
  const filters = useAtomValue(galleryFiltersAtom)
  const { t } = useTranslation()
  
  // Erstelle eine Map für schnelles Label-Lookup
  const labelMap = new Map<string, string>()
  facetDefs.forEach(def => {
    labelMap.set(def.metaKey, def.label || def.metaKey)
  })
  
  // Erstelle eine Map für Dokumentennamen (fileId -> title)
  const docTitleMap = new Map<string, string>()
  docs.forEach(doc => {
    const id = doc.fileId || doc.id
    if (id) {
      const title = doc.shortTitle || doc.title || id
      docTitleMap.set(id, title)
    }
  })
  
  // Extrahiere alle gesetzten Filter-Werte
  const activeFilters: Array<{ key: string; value: string }> = []
  Object.entries(filters as Record<string, string[] | undefined>).forEach(([key, values]) => {
    if (Array.isArray(values) && values.length > 0) {
      if (key === 'fileId') {
        // fileId-Filter: Zeige Dokumentennamen oder Anzahl
        if (showReferenceLegend) {
          // Im Quellenverzeichnis-Modus: Anzahl anzeigen
          activeFilters.push({ key: t('gallery.references'), value: `${values.length} ${values.length === 1 ? t('gallery.document') : t('gallery.documents')}` })
        } else {
          // Normale Anzeige: Dokumentennamen anzeigen
          values.forEach(fileId => {
            const docTitle = docTitleMap.get(fileId) || fileId
            activeFilters.push({ key: t('gallery.document'), value: docTitle })
          })
        }
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
    <div className="border-b bg-muted/30 px-4 py-2 flex items-center gap-2 flex-wrap">
      {/* Filter-Icon - nur anzeigen wenn hideFilterButton nicht gesetzt */}
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

      {/* Dokumentenanzahl - immer anzeigen */}
      <div className="text-sm text-muted-foreground shrink-0">
        {docCount} {docCount === 1 ? t('gallery.document') : t('gallery.documents')}
        {hasActiveFilters && ` - ${t('gallery.filtered')}:`}
      </div>

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
  )
}

