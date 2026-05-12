'use client'

import React from 'react'
import { Star, EyeOff, HelpCircle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/hooks'
import { cn } from '@/lib/utils'

export interface TinderStatusBarProps {
  total: number
  index: number
  unratedCount: number
  favoriteCount: number
  notImportantCount: number
  className?: string
}

/**
 * Schmaler Status-Streifen unterhalb des Detail-Headers im Tinder-Mode.
 *
 * Zeigt: aktuelle Position in der Sequenz (z.B. "3 / 12") + drei
 * Counter (Favoriten, Unbewertet, Nicht wichtig).
 */
export function TinderStatusBar({
  total,
  index,
  unratedCount,
  favoriteCount,
  notImportantCount,
  className,
}: TinderStatusBarProps) {
  const { t } = useTranslation()
  const position = total > 0 && index >= 0 ? `${index + 1} / ${total}` : `0 / ${total}`

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-md border border-amber-300/60 bg-amber-50/60 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-100',
        className,
      )}
      role="status"
    >
      <span className="font-semibold tabular-nums">
        {t('gallery.tinder.position', { position, defaultValue: 'Position {{position}}' })}
      </span>
      <span className="inline-flex items-center gap-1">
        <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
        <span className="tabular-nums">{favoriteCount}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        <span className="tabular-nums">{unratedCount}</span>
        <span className="hidden sm:inline">
          {t('gallery.tinder.unrated', { defaultValue: 'unbewertet' })}
        </span>
      </span>
      <span className="inline-flex items-center gap-1 opacity-80">
        <EyeOff className="h-3.5 w-3.5" aria-hidden />
        <span className="tabular-nums">{notImportantCount}</span>
        <span className="hidden sm:inline">
          {t('gallery.tinder.notImportant', { defaultValue: 'nicht wichtig' })}
        </span>
      </span>
    </div>
  )
}
