'use client'

import React from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks'
import { useLibraryRole } from '@/hooks/gallery/use-library-role'
import { useUserStates } from '@/hooks/gallery/use-user-states'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { FavoriteVoter } from '@/types/source-user-state'

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
  /** Optionale CSS-Klassen fuer die Position (z.B. `absolute bottom-2 right-2`). */
  className?: string
}

/**
 * Dezente Stern-Badge fuer Galerie-Karten (alle 5 Card-Subtypen).
 *
 * Member-only: rendert nichts fuer Gaeste/Anonyme.
 */
export function SourceStarsBadge({
  libraryId,
  fileId,
  isFavorite,
  favoriteCount = 0,
  favoriteVoters,
  onToggleFavorite,
  variant = 'dark',
  className,
}: SourceStarsBadgeProps) {
  const { t } = useTranslation()
  const role = useLibraryRole(libraryId ?? '')
  const visibleForStateHook = React.useMemo(
    () => (onToggleFavorite ? [] : fileId ? [fileId] : []),
    [onToggleFavorite, fileId],
  )
  const userStates = useUserStates(libraryId ?? '', visibleForStateHook)
  const [isPending, setIsPending] = React.useState(false)

  if (!libraryId || !fileId) return null
  if (!role.isMember) return null

  const count = favoriteCount
  const voters = Array.isArray(favoriteVoters) ? favoriteVoters : []

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

  const toggleLabel = isFavorite
    ? t('gallery.favorites.toggleRemove', { defaultValue: 'Aus Favoriten entfernen' })
    : t('gallery.favorites.toggleAdd', { defaultValue: 'Zu Favoriten hinzufuegen' })

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5',
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
                'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                isFavorite ? palette.activeIcon : palette.idleIcon,
              )}
            >
              <Star
                className="h-3.5 w-3.5"
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
                  'pr-1 text-[11px] font-semibold leading-none tabular-nums select-none cursor-default',
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

interface VoterTooltipBodyProps {
  voters: FavoriteVoter[]
}

function emailPrefix(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return email
  return email.slice(0, at)
}

function VoterTooltipBody({ voters }: VoterTooltipBodyProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium opacity-70">
        {t('gallery.favorites.voterTooltipHeader', {
          count: voters.length,
          defaultValue: 'Sterne ({{count}})',
        })}
      </div>
      <ul className="flex flex-col gap-0.5">
        {voters.map((voter) => {
          const name = voter.name?.trim() || emailPrefix(voter.email)
          return (
            <li key={voter.email} className="truncate text-xs">
              {name}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
