'use client'

import React from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/hooks'
import { useLibraryRole } from '@/hooks/gallery/use-library-role'
import { cn } from '@/lib/utils'

export interface SourceFavoriteToggleProps {
  libraryId: string
  fileId: string
  isFavorite: boolean
  onToggle: (fileId: string) => Promise<void> | void
  /**
   * Optional: liefert sofort ein passendes Tooltip/aria-Label, ohne dass
   * der Caller zwei Strings durchreichen muss.
   */
  busy?: boolean
}

/**
 * Star-Toggle pro Quelle in der Tabelle.
 * Wird nur fuer Owner und aktive Co-Creator gerendert (`isMember`-Gate),
 * damit Gaeste/Anonyme die Spalte nicht sehen.
 */
export function SourceFavoriteToggle({
  libraryId,
  fileId,
  isFavorite,
  onToggle,
  busy,
}: SourceFavoriteToggleProps) {
  const { t } = useTranslation()
  const { isMember } = useLibraryRole(libraryId)
  const [isPending, setIsPending] = React.useState(false)

  if (!isMember) return null

  const label = isFavorite
    ? t('gallery.favorites.toggleRemove', { defaultValue: 'Aus Favoriten entfernen' })
    : t('gallery.favorites.toggleAdd', { defaultValue: 'Zu Favoriten hinzufuegen' })

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPending || !fileId) return
    setIsPending(true)
    try {
      await onToggle(fileId)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      onClick={handleClick}
      disabled={isPending || busy}
      aria-pressed={isFavorite}
      aria-label={label}
      title={label}
      className={cn(
        'h-8 w-8',
        isFavorite ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Star
        className="h-4 w-4"
        fill={isFavorite ? 'currentColor' : 'none'}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </Button>
  )
}
