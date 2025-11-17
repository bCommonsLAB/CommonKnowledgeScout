'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Grid3x3, Table2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/hooks'
import { cn } from '@/lib/utils'
import type { ViewMode } from './gallery-sticky-header'

export interface ViewModeToggleProps {
  /** Aktueller View-Mode */
  viewMode: ViewMode
  /** Callback für View-Mode-Änderung */
  onViewModeChange: (mode: ViewMode) => void
  /** Kompakte Variante (kleinere Buttons) */
  compact?: boolean
}

/**
 * Wiederverwendbare View-Mode-Toggle-Komponente
 * Zeigt Buttons zum Wechseln zwischen Grid- und Tabellenansicht
 */
export function ViewModeToggle({ viewMode, onViewModeChange, compact = false }: ViewModeToggleProps) {
  const { t } = useTranslation()

  return (
    <div className={cn(
      "flex items-center gap-1 border rounded-md p-1 bg-muted/50",
      compact && "p-0.5"
    )}>
      <Button
        variant="ghost"
        size={compact ? "sm" : "sm"}
        onClick={() => onViewModeChange('grid')}
        className={cn(
          compact ? "h-7 px-2 gap-1" : "h-8 px-3 gap-2",
          viewMode === 'grid' && "bg-background shadow-sm"
        )}
        aria-label={t('gallery.viewMode.grid')}
      >
        <Grid3x3 className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
        {!compact && <span className="hidden sm:inline">{t('gallery.viewMode.grid')}</span>}
      </Button>
      <Button
        variant="ghost"
        size={compact ? "sm" : "sm"}
        onClick={() => onViewModeChange('table')}
        className={cn(
          compact ? "h-7 px-2 gap-1" : "h-8 px-3 gap-2",
          viewMode === 'table' && "bg-background shadow-sm"
        )}
        aria-label={t('gallery.viewMode.table')}
      >
        <Table2 className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
        {!compact && <span className="hidden sm:inline">{t('gallery.viewMode.table')}</span>}
      </Button>
    </div>
  )
}

