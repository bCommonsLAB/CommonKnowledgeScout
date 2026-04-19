'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { LayoutGrid, StretchHorizontal } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/hooks'
import { cn } from '@/lib/utils'
import type { GalleryCardDensity } from '@/lib/gallery/gallery-card-density'

export interface GalleryCardDensityToggleProps {
  cardDensity: GalleryCardDensity
  onCardDensityChange: (density: GalleryCardDensity) => void
  /** Kleinere Buttons (z. B. FilterContextBar) */
  compact?: boolean
}

/**
 * Umschalten Kompakt vs. Komfortabel für die Wissensgalerie-Grid-Ansicht (nur bei viewMode grid sinnvoll).
 */
export function GalleryCardDensityToggle({
  cardDensity,
  onCardDensityChange,
  compact = false,
}: GalleryCardDensityToggleProps) {
  const { t } = useTranslation()

  // Nur Icons sichtbar; Bezeichnungen wie beim Story-Mode-CTA per Tooltip (siehe switch-to-story-mode-button).
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex items-center gap-1 border rounded-md p-1 bg-muted/50',
          compact && 'p-0.5'
        )}
        role="group"
        aria-label={t('gallery.cardDensityToggleAria')}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCardDensityChange('comfortable')}
              className={cn(
                compact ? 'h-7 px-2' : 'h-8 px-3',
                cardDensity === 'comfortable' && 'bg-background shadow-sm'
              )}
              aria-pressed={cardDensity === 'comfortable'}
              aria-label={t('gallery.cardDensityComfortable')}
            >
              <StretchHorizontal className={cn(compact ? 'h-3 w-3' : 'h-4 w-4')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('gallery.cardDensityComfortable')}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCardDensityChange('compact')}
              className={cn(
                compact ? 'h-7 px-2' : 'h-8 px-3',
                cardDensity === 'compact' && 'bg-background shadow-sm'
              )}
              aria-pressed={cardDensity === 'compact'}
              aria-label={t('gallery.cardDensityCompact')}
            >
              <LayoutGrid className={cn(compact ? 'h-3 w-3' : 'h-4 w-4')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('gallery.cardDensityCompact')}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
