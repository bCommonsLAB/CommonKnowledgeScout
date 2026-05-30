'use client'

import { ClipboardCheck, Star, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from '@/lib/i18n/hooks'
import { cn } from '@/lib/utils'

export interface RatingModeBarProps {
  /** Bewertungsmodus an/aus. */
  active: boolean
  onChange: (active: boolean) => void
  /** Filter: nur noch nicht bewertete Quellen durchgehen. */
  onlyUnrated: boolean
  onChangeOnlyUnrated: (only: boolean) => void
  /** Fortschritt aus dem Sequencer. */
  total: number
  index: number
  unratedCount: number
  favoriteCount: number
  notImportantCount: number
  /** "Wichtig & weiter": favorisiert die aktuelle Quelle und springt zur naechsten. */
  onRateImportant: () => void | Promise<void>
  /** "Nicht wichtig & weiter": markiert privat als nicht wichtig und springt weiter. */
  onRateNotImportant: () => void | Promise<void>
  /** Aktuelle Quelle ist bereits favorisiert (Button-Highlight). */
  isCurrentFavorite?: boolean
  /** Aktuelle Quelle ist bereits als nicht wichtig markiert. */
  isCurrentNotImportant?: boolean
  /** Deaktiviert die Aktions-Buttons (z.B. keine fileId). */
  disabled?: boolean
}

/**
 * Bewertungsmodus-Leiste im Detail-Header (loest den fruehen "Tinder-Modus"
 * inkl. Wisch-Geste ab).
 *
 * - Toggle "Bewertungsmodus" + Switch "nur Unbewertete".
 * - Aktiv: zwei nuechterne Navigations-Buttons "Nicht wichtig & weiter" /
 *   "Wichtig & weiter" plus ein kompakter Fortschritt (Position + Counter).
 *
 * Member-only: der Aufrufer rendert die Leiste nur fuer Owner/Co-Creators.
 */
export function RatingModeBar({
  active,
  onChange,
  onlyUnrated,
  onChangeOnlyUnrated,
  total,
  index,
  unratedCount,
  favoriteCount,
  notImportantCount,
  onRateImportant,
  onRateNotImportant,
  isCurrentFavorite,
  isCurrentNotImportant,
  disabled,
}: RatingModeBarProps) {
  const { t } = useTranslation()
  const toggleLabel = t('gallery.rating.toggle', { defaultValue: 'Bewertungsmodus' })
  const position = total > 0 && index >= 0 ? `${index + 1} / ${total}` : `0 / ${total}`

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant={active ? 'secondary' : 'ghost'}
          size="sm"
          type="button"
          onClick={() => onChange(!active)}
          aria-pressed={active}
          className={cn('h-8 px-2 gap-1.5', active && 'text-amber-700 dark:text-amber-300')}
          title={toggleLabel}
        >
          <ClipboardCheck className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{toggleLabel}</span>
        </Button>
        {active ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
            <Switch
              checked={onlyUnrated}
              onCheckedChange={(v) => onChangeOnlyUnrated(Boolean(v))}
              aria-label={t('gallery.rating.onlyUnrated', { defaultValue: 'Nur Unbewertete' })}
            />
            <span>{t('gallery.rating.onlyUnrated', { defaultValue: 'Nur Unbewertete' })}</span>
          </label>
        ) : null}
      </div>

      {active ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={disabled}
            onClick={() => void onRateNotImportant()}
            className={cn('h-8 gap-1.5', isCurrentNotImportant && 'border-muted-foreground/60')}
          >
            <EyeOff className="h-4 w-4" aria-hidden />
            {t('gallery.rating.notImportant', { defaultValue: 'Nicht wichtig & weiter' })}
          </Button>
          <Button
            variant="default"
            size="sm"
            type="button"
            disabled={disabled}
            onClick={() => void onRateImportant()}
            className="h-8 gap-1.5"
          >
            <Star className={cn('h-4 w-4', isCurrentFavorite && 'fill-current')} aria-hidden />
            {t('gallery.rating.important', { defaultValue: 'Wichtig & weiter' })}
          </Button>

          <span className="ml-auto inline-flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-semibold tabular-nums">{position}</span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-current text-amber-500" aria-hidden />
              <span className="tabular-nums">{favoriteCount}</span>
            </span>
            <span className="tabular-nums">
              {unratedCount} {t('gallery.rating.unrated', { defaultValue: 'unbewertet' })}
            </span>
            <span className="inline-flex items-center gap-1 opacity-80">
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
              <span className="tabular-nums">{notImportantCount}</span>
            </span>
          </span>
        </div>
      ) : null}
    </div>
  )
}
