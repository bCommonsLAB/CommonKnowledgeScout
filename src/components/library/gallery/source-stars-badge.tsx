'use client'

import React from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks'
import { useLibraryRole } from '@/hooks/gallery/use-library-role'
import { useUserStates } from '@/hooks/gallery/use-user-states'
import { useAggregatedFavorites } from '@/hooks/gallery/use-aggregated-favorites'
import { useMemberDisplayNames } from '@/hooks/gallery/use-member-display-names'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface SourceStarsBadgeProps {
  libraryId?: string
  fileId?: string
  /** Visuelle Variante: hell (auf dunkler Karte) oder dunkel (auf heller Karte). */
  variant?: 'light' | 'dark'
  /** Optionale CSS-Klassen fuer die Position (z.B. `absolute bottom-2 right-2`). */
  className?: string
}

/**
 * Dezente Stern-Badge fuer Galerie-Karten (alle 5 Card-Subtypen).
 *
 * Zeigt:
 * - Eigenen Stern (klickbar - toggelt favorite/null)
 * - Aggregierten Counter (nur wenn > 0)
 * - Tooltip mit Voter-Namen (bei Hover, lazy via `useMemberDisplayNames`)
 *
 * Member-only: rendert nichts fuer Gaeste/Anonyme. Datenfetching laeuft
 * ueber die zentralen Hooks (Atom-Cache wird mit anderen Views geteilt).
 */
export function SourceStarsBadge({
  libraryId,
  fileId,
  variant = 'dark',
  className,
}: SourceStarsBadgeProps) {
  const { t } = useTranslation()
  const role = useLibraryRole(libraryId ?? '')
  const userStates = useUserStates(libraryId ?? '')
  // Array stabil halten, sonst triggert der Hook-Effect bei jedem Render
  // einen Re-Fetch und setzt counts/voters mit neuer Referenz - was wiederum
  // ein erneutes Rendern ausloest (infinite loop).
  const visibleFileIds = React.useMemo(() => (fileId ? [fileId] : []), [fileId])
  const aggregated = useAggregatedFavorites(libraryId ?? '', visibleFileIds)
  const { resolveNames, getCachedName } = useMemberDisplayNames(libraryId ?? '')
  const [isPending, setIsPending] = React.useState(false)

  if (!libraryId || !fileId) return null
  if (!role.isMember) return null

  const isFavorite = userStates.isFavorite(fileId)
  const count = aggregated.counts[fileId] ?? 0
  const voters = aggregated.voters[fileId] ?? []

  const onToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (isPending) return
    setIsPending(true)
    try {
      const next = isFavorite ? null : 'favorite'
      await userStates.setState(fileId, next)
      aggregated.invalidate(fileId)
    } finally {
      setIsPending(false)
    }
  }

  const handleHover = () => {
    if (voters.length === 0) return
    const missing = voters.filter((v) => !getCachedName(v))
    if (missing.length === 0) return
    void resolveNames(missing)
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
        onMouseEnter={handleHover}
        onFocus={handleHover}
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
              <VoterTooltipBody
                voters={voters}
                resolveNames={resolveNames}
                getCachedName={getCachedName}
              />
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  )
}

interface VoterTooltipBodyProps {
  voters: string[]
  resolveNames: (emails: string[]) => Promise<void>
  getCachedName: (email: string) => string | undefined
}

function VoterTooltipBody({ voters, resolveNames, getCachedName }: VoterTooltipBodyProps) {
  const { t } = useTranslation()
  React.useEffect(() => {
    const missing = voters.filter((v) => !getCachedName(v))
    if (missing.length === 0) return
    void resolveNames(missing)
  }, [voters, resolveNames, getCachedName])

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium opacity-70">
        {t('gallery.favorites.voterTooltipHeader', {
          count: voters.length,
          defaultValue: 'Sterne ({{count}})',
        })}
      </div>
      <ul className="flex flex-col gap-0.5">
        {voters.map((email) => (
          <li key={email} className="truncate text-xs">
            {getCachedName(email) ?? email}
          </li>
        ))}
      </ul>
    </div>
  )
}
