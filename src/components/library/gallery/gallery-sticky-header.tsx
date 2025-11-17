'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Search, Grid3x3, Table2 } from 'lucide-react'
import { useScrollVisibility } from '@/hooks/use-scroll-visibility'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/hooks'
import { cn } from '@/lib/utils'

export type ViewMode = 'grid' | 'table'

export interface GalleryStickyHeaderProps {
  headline: string
  subtitle?: string
  description?: string
  searchPlaceholder: string
  queryValue: string
  onChangeQuery: (v: string) => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
}

/**
 * Sticky-Header der Gallery-Ansicht:
 * - Blendet beim Scrollen Titel/Untertitel/Erklärung aus
 * - Lässt die Suchleiste sichtbar
 * - Keine Änderungen an anderer Scroll-Logik
 */
export function GalleryStickyHeader(props: GalleryStickyHeaderProps) {
  const {
    headline,
    subtitle,
    description,
    searchPlaceholder,
    queryValue,
    onChangeQuery,
    viewMode = 'grid',
    onViewModeChange,
  } = props

  const { t } = useTranslation()

  // Verwende gemeinsamen Scroll-Visibility-Hook (wie TopNav)
  // isVisible === false bedeutet: Header-Bereich ausblenden (condensed)
  const isVisible = useScrollVisibility()
  const isCondensed = !isVisible

  return (
    <div className="sticky top-0 z-20 bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur border-b">
      <div 
        className={`transition-all duration-300 overflow-hidden ${
          isCondensed 
            ? 'max-h-0 opacity-0 pointer-events-none' 
            : 'max-h-96 opacity-100'
        }`}
        style={{
          willChange: isCondensed ? 'max-height, opacity' : 'auto',
          // Verhindere Layout-Shifts während Transition (robuster für ältere Geräte)
          contain: 'layout style paint'
        }}
      >
        <div className="py-4 space-y-2">
          <h2 className="text-3xl font-bold">{headline}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground font-medium">{subtitle}</p> : null}
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="py-2 flex items-center gap-2 sm:gap-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={queryValue}
            onChange={(e) => onChangeQuery(e.target.value)}
            className="pl-10 text-sm sm:text-base"
          />
        </div>
        {/* View Mode Toggle */}
        {onViewModeChange && (
          <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewModeChange('grid')}
              className={cn(
                "h-8 px-3 gap-2",
                viewMode === 'grid' && "bg-background shadow-sm"
              )}
              aria-label={t('gallery.viewMode.grid')}
            >
              <Grid3x3 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('gallery.viewMode.grid')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewModeChange('table')}
              className={cn(
                "h-8 px-3 gap-2",
                viewMode === 'table' && "bg-background shadow-sm"
              )}
              aria-label={t('gallery.viewMode.table')}
            >
              <Table2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('gallery.viewMode.table')}</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}



