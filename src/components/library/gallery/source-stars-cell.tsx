'use client'

import React from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n/hooks'
import { useLibraryRole } from '@/hooks/gallery/use-library-role'
import { useMemberDisplayNames } from '@/hooks/gallery/use-member-display-names'
import { cn } from '@/lib/utils'

export interface SourceStarsCellProps {
  libraryId: string
  fileId: string
  /** Eigener Stern an/aus. */
  isFavorite: boolean
  /** Aggregierter Counter (alle Member, die `state='favorite'` haben). */
  count?: number
  /** Voter-E-Mails (alle, auch der eigene User). Sortiert. */
  voters?: string[]
  /** Toggelt den eigenen Stern (`favorite` <-> null). */
  onToggleFavorite: (fileId: string) => Promise<void> | void
  /** Optional: groessere Variante (z.B. fuer Detail-Header). */
  size?: 'sm' | 'md'
}

/**
 * Kombinierte Stern-Spalte: eigener Stern-Toggle plus aggregierter
 * Counter mit Tooltip-Liste der Voter-Namen.
 *
 * Member-only: rendert nichts fuer Gaeste/Anonyme. Tooltip-Namen werden
 * lazy beim ersten Hover via `useMemberDisplayNames` geladen (Bundling
 * mehrerer Sterne im selben Render-Frame).
 */
export function SourceStarsCell({
  libraryId,
  fileId,
  isFavorite,
  count = 0,
  voters,
  onToggleFavorite,
  size = 'sm',
}: SourceStarsCellProps) {
  const { t } = useTranslation()
  const { isMember } = useLibraryRole(libraryId)
  const { resolveNames, getCachedName } = useMemberDisplayNames(libraryId)
  const [isPending, setIsPending] = React.useState(false)

  if (!isMember) return null

  const safeVoters = Array.isArray(voters) ? voters : []
  const hasVoters = safeVoters.length > 0

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPending || !fileId) return
    setIsPending(true)
    try {
      await onToggleFavorite(fileId)
    } finally {
      setIsPending(false)
    }
  }

  const handleHover = () => {
    if (!hasVoters) return
    const missing = safeVoters.filter((v) => !getCachedName(v))
    if (missing.length === 0) return
    void resolveNames(missing)
  }

  const toggleLabel = isFavorite
    ? t('gallery.favorites.toggleRemove', { defaultValue: 'Aus Favoriten entfernen' })
    : t('gallery.favorites.toggleAdd', { defaultValue: 'Zu Favoriten hinzufuegen' })

  const iconSizeClass = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  const buttonSizeClass = size === 'md' ? 'h-9 w-9' : 'h-8 w-8'

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="flex items-center gap-1"
        onMouseEnter={handleHover}
        onFocus={handleHover}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={handleToggle}
              disabled={isPending}
              aria-pressed={isFavorite}
              aria-label={toggleLabel}
              className={cn(
                buttonSizeClass,
                isFavorite
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Star
                className={iconSizeClass}
                fill={isFavorite ? 'currentColor' : 'none'}
                aria-hidden
              />
              <span className="sr-only">{toggleLabel}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{toggleLabel}</TooltipContent>
        </Tooltip>

        {count > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-flex items-center text-xs tabular-nums',
                  size === 'md' ? 'text-sm' : 'text-xs',
                  'text-amber-700 dark:text-amber-300 cursor-default select-none',
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
              <VoterTooltipContent voters={safeVoters} resolveNames={resolveNames} getCachedName={getCachedName} />
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  )
}

interface VoterTooltipContentProps {
  voters: string[]
  resolveNames: (emails: string[]) => Promise<void>
  getCachedName: (email: string) => string | undefined
}

function VoterTooltipContent({ voters, resolveNames, getCachedName }: VoterTooltipContentProps) {
  const { t } = useTranslation()
  // Beim Mount des Tooltips alle fehlenden Namen on-demand resolven.
  React.useEffect(() => {
    const missing = voters.filter((v) => !getCachedName(v))
    if (missing.length === 0) return
    void resolveNames(missing)
  }, [voters, resolveNames, getCachedName])

  const initials = (name: string): string => {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase()
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium opacity-70">
        {t('gallery.favorites.voterTooltipHeader', {
          count: voters.length,
          defaultValue: 'Sterne ({{count}})',
        })}
      </div>
      <ul className="flex flex-col gap-0.5">
        {voters.map((email) => {
          const name = getCachedName(email) ?? email
          return (
            <li key={email} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-900 dark:bg-amber-800 dark:text-amber-50"
              >
                {initials(name)}
              </span>
              <span className="truncate">{name}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
