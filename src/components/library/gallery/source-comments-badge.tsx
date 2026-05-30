'use client'

import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks'
import { useLibraryRole } from '@/hooks/gallery/use-library-role'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface SourceCommentsBadgeProps {
  libraryId?: string
  fileId?: string
  /** Aggregierte Anzahl nicht-geloeschter Kommentare (aus `GET docs`, member-only). */
  commentCount?: number
  /** Visuelle Variante: hell (auf dunkler Karte) oder dunkel (auf heller Karte). */
  variant?: 'light' | 'dark'
  /** Optionale CSS-Klassen fuer die Position. */
  className?: string
}

/**
 * Dezenter Kommentar-Indikator fuer Galerie-Karten (alle Card-Subtypen).
 *
 * Reiner Zaehler (kein Toggle) - das Pendant zur interaktiven
 * `SourceStarsBadge`. Member-only und nur sichtbar, wenn mindestens ein
 * Kommentar existiert (sonst kein visuelles Rauschen). Klicks blubbern zur
 * Karte hoch (oeffnet die Detail-Ansicht).
 */
export function SourceCommentsBadge({
  libraryId,
  fileId,
  commentCount = 0,
  variant = 'dark',
  className,
}: SourceCommentsBadgeProps) {
  const { t } = useTranslation()
  const role = useLibraryRole(libraryId ?? '')

  if (!libraryId || !fileId) return null
  if (!role.isMember) return null
  if (commentCount <= 0) return null

  const palette =
    variant === 'light'
      ? { bg: 'bg-black/30 backdrop-blur-sm', icon: 'text-white/80', counter: 'text-white' }
      : {
          bg: 'bg-background/80 backdrop-blur-sm border border-border/60',
          icon: 'text-muted-foreground',
          counter: 'text-foreground',
        }

  const label = t('gallery.comments.badge', {
    count: commentCount,
    defaultValue: '{{count}} Kommentare',
  })

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-full px-2 cursor-default select-none',
              palette.bg,
              className,
            )}
            aria-label={label}
          >
            <MessageCircle className={cn('h-3.5 w-3.5', palette.icon)} aria-hidden />
            <span
              className={cn(
                'text-[11px] font-semibold leading-none tabular-nums',
                palette.counter,
              )}
            >
              {commentCount}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
