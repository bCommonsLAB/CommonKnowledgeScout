'use client'

import React from 'react'
import { Star } from 'lucide-react'
import { cn } from '@ks/util'
import { useTranslation } from '@ks/i18n/react'
import { useSterneSichtbar } from '../hooks/use-star-counts-public'
import { useUserStates } from '../hooks/use-user-states'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@ks/ui'
import type { FavoriteVoter } from '@ks/contracts'
import { VoterTooltipBody } from './source-stars-voter-tooltip'

export interface SourceStarsBadgeProps {
  libraryId?: string
  fileId?: string
  /** Kommt aus dem Galerie-Doc (`GET docs`), nicht aus einem separaten Aggregations-Call. */
  isFavorite: boolean
  favoriteCount?: number
  favoriteVoters?: FavoriteVoter[]
  /**
   * Stern togglen (optimistisch, wenn vom `gallery-root` durchgereicht).
   * Ohne Callback: Fallback nur `POST source-user-states` (kein SWR-Patch).
   */
  onToggleFavorite?: (fileId: string) => void | Promise<void>
  /** Visuelle Variante: hell (auf dunkler Karte) oder dunkel (auf heller Karte). */
  variant?: 'light' | 'dark'
  /** Groesse: `compact` fuer die dichte Kachel (kleinerer Stern, kleinere Zahl). */
  size?: 'default' | 'compact'
  /** Optionale CSS-Klassen fuer die Position (z.B. `absolute bottom-2 right-2`). */
  className?: string
}

/**
 * Dezente Stern-Badge fuer Galerie-Karten (alle 5 Card-Subtypen).
 *
 * Mitglieder: Stern zum Klicken, Zahl, Namen im Tooltip. Besucher sehen bei
 * `starCountsPublic` (ADR 0012) nur die Zahl, lesend, ohne Namen; sonst nichts.
 */
export function SourceStarsBadge({
  libraryId,
  fileId,
  isFavorite,
  favoriteCount = 0,
  favoriteVoters,
  onToggleFavorite,
  variant = 'dark',
  size = 'default',
  className,
}: SourceStarsBadgeProps) {
  const { t } = useTranslation()
  const { isMember, starCountsPublic } = useSterneSichtbar(libraryId ?? '')
  const visibleForStateHook = React.useMemo(
    () => (onToggleFavorite ? [] : fileId ? [fileId] : []),
    [onToggleFavorite, fileId],
  )
  const userStates = useUserStates(libraryId ?? '', visibleForStateHook)
  const [isPending, setIsPending] = React.useState(false)

  if (!libraryId || !fileId) return null

  const count = favoriteCount
  const voters = Array.isArray(favoriteVoters) ? favoriteVoters : []
  // Masse je Groesse — beide Werte explizit, kein Default-Zweig.
  const masse =
    size === 'compact'
      ? { pill: 'px-1 py-0', button: 'h-5 w-5', icon: 'h-3 w-3', counter: 'text-[10px]' }
      : { pill: 'px-1.5 py-0.5', button: 'h-6 w-6', icon: 'h-3.5 w-3.5', counter: 'text-[11px]' }

  const palette =
    variant === 'light'
      ? {
          bg: 'bg-black/30 backdrop-blur-sm hover:bg-black/40',
          activeIcon: 'text-amber-300',
          idleIcon: 'text-white/70 hover:text-white',
          counter: 'text-amber-200',
        }
      : {
          bg: 'bg-background/80 backdrop-blur-sm hover:bg-background/90 border border-border/60',
          activeIcon: 'text-amber-500',
          idleIcon: 'text-muted-foreground hover:text-foreground',
          counter: 'text-amber-700 dark:text-amber-300',
        }

  if (!isMember) {
    // Besucher: nur die Zahl, nur wenn die Library sie freigibt und sie > 0 ist.
    if (!starCountsPublic || count <= 0) return null
    return (
      <span
        className={cn('inline-flex items-center gap-1 rounded-full select-none', masse.pill, palette.bg, className)}
        aria-label={t('gallery.favorites.publicCount', { count, defaultValue: '{count} Sterne' })}
        title={t('gallery.favorites.publicCount', { count, defaultValue: '{count} Sterne' })}
      >
        <Star className={cn(masse.icon, palette.activeIcon)} fill="currentColor" aria-hidden />
        <span className={cn('pr-1 font-semibold leading-none tabular-nums', masse.counter, palette.counter)}>{count}</span>
      </span>
    )
  }

  const onToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (isPending) return
    setIsPending(true)
    try {
      if (onToggleFavorite) {
        await onToggleFavorite(fileId)
      } else {
        const next = isFavorite ? null : 'favorite'
        await userStates.setState(fileId, next)
      }
    } finally {
      setIsPending(false)
    }
  }

  const toggleLabel = isFavorite
    ? t('gallery.favorites.toggleRemove', { defaultValue: 'Aus Favoriten entfernen' })
    : t('gallery.favorites.toggleAdd', { defaultValue: 'Zu Favoriten hinzufuegen' })

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-full',
          masse.pill,
          palette.bg,
          className,
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggle}
              disabled={isPending}
              aria-pressed={isFavorite}
              aria-label={toggleLabel}
              className={cn(
                'flex items-center justify-center rounded-full transition-colors',
                masse.button,
                isFavorite ? palette.activeIcon : palette.idleIcon,
              )}
            >
              <Star
                className={masse.icon}
                fill={isFavorite ? 'currentColor' : 'none'}
                aria-hidden
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{toggleLabel}</TooltipContent>
        </Tooltip>

        {count > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'pr-1 font-semibold leading-none tabular-nums select-none cursor-default',
                  masse.counter,
                  palette.counter,
                )}
                aria-label={t('gallery.favorites.aggregatedCount', {
                  count,
                  defaultValue: '{{count}} Sterne von Mitgliedern',
                })}
              >
                {count}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px]">
              <VoterTooltipBody voters={voters} />
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  )
}
