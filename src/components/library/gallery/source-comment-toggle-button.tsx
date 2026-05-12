'use client'

import React from 'react'
import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/hooks'
import { cn } from '@/lib/utils'

export interface SourceCommentToggleButtonProps {
  open: boolean
  count: number | undefined
  onToggle: () => void
}

/**
 * Chevron + Counter zum Aufklappen der Kommentar-Zeile.
 * Counter bleibt versteckt, solange er noch unbekannt ist (undefined),
 * damit Spalten nicht "zappeln" beim Scrollen.
 */
export function SourceCommentToggleButton({
  open,
  count,
  onToggle,
}: SourceCommentToggleButtonProps) {
  const { t } = useTranslation()
  const ariaLabel = open
    ? t('gallery.comments.collapse', { defaultValue: 'Kommentare einklappen' })
    : t('gallery.comments.expand', { defaultValue: 'Kommentare ausklappen' })

  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-expanded={open}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        'h-8 px-1.5 gap-1 text-muted-foreground hover:text-foreground',
        open && 'text-foreground',
      )}
    >
      {open ? (
        <ChevronDown className="h-4 w-4" aria-hidden />
      ) : (
        <ChevronRight className="h-4 w-4" aria-hidden />
      )}
      <MessageSquare className="h-3.5 w-3.5" aria-hidden />
      {typeof count === 'number' && count > 0 ? (
        <span className="text-xs tabular-nums">{count}</span>
      ) : null}
    </Button>
  )
}
