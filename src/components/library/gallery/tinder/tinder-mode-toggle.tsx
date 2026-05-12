'use client'

import React from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from '@/lib/i18n/hooks'
import { cn } from '@/lib/utils'

export interface TinderModeToggleProps {
  active: boolean
  onChange: (active: boolean) => void
  /** Wenn true, wird auch ein Filter-Chip "nur Unbewertete" gerendert. */
  showOnlyUnratedToggle?: boolean
  onlyUnrated?: boolean
  onChangeOnlyUnrated?: (only: boolean) => void
  className?: string
}

/**
 * Toggle-Button fuer den Tinder-Mode in der Detail-Overlay.
 *
 * Zeigt zusaetzlich einen Switch "nur Unbewertete", mit dem der User
 * die Sequenz auf noch nicht bewertete Quellen reduzieren kann.
 */
export function TinderModeToggle({
  active,
  onChange,
  showOnlyUnratedToggle = true,
  onlyUnrated,
  onChangeOnlyUnrated,
  className,
}: TinderModeToggleProps) {
  const { t } = useTranslation()
  const tinderLabel = t('gallery.tinder.toggle', { defaultValue: 'Tinder-Modus' })

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Button
        variant={active ? 'secondary' : 'ghost'}
        size="sm"
        type="button"
        onClick={() => onChange(!active)}
        aria-pressed={active}
        className={cn('h-8 px-2 gap-1.5', active && 'text-amber-700 dark:text-amber-300')}
        title={tinderLabel}
      >
        <Sparkles className={cn('h-4 w-4', active && 'fill-current')} aria-hidden />
        <span className="hidden sm:inline">{tinderLabel}</span>
      </Button>
      {active && showOnlyUnratedToggle && onChangeOnlyUnrated ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
          <Switch
            checked={!!onlyUnrated}
            onCheckedChange={(v) => onChangeOnlyUnrated(Boolean(v))}
            aria-label={t('gallery.tinder.onlyUnrated', { defaultValue: 'Nur Unbewertete' })}
          />
          <span>{t('gallery.tinder.onlyUnrated', { defaultValue: 'Nur Unbewertete' })}</span>
        </label>
      ) : null}
    </div>
  )
}
