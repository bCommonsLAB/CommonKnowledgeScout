/**
 * @fileoverview Status-Chips fuer Publikation und Translation pro Locale
 *
 * @description
 * Zeigt in der Galerie-Tabelle:
 *  - PublishStatusBadge: 'draft' | 'published'
 *  - TranslationStatusChips: pro Locale ein Chip mit Status-Farbe.
 *
 * Beide Komponenten sind reine View-Komponenten ohne API-Logik.
 *
 * @module components/library/gallery
 */

'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n/hooks'
import type { DocCardMeta } from '@/lib/gallery/types'

export interface PublishStatusBadgeProps {
  status: DocCardMeta['publicationStatus']
}

/** Kleines Badge fuer den Publish-Status. Default: 'draft' wenn nicht gesetzt. */
export function PublishStatusBadge({ status }: PublishStatusBadgeProps) {
  const { t } = useTranslation()
  const isPublished = status === 'published'
  return (
    <Badge
      variant={isPublished ? 'default' : 'secondary'}
      className='text-[10px] uppercase tracking-wide'
      title={isPublished ? 'published' : 'draft'}
    >
      {isPublished
        ? t('gallery.publish.statusPublished', { defaultValue: 'Veröffentlicht' })
        : t('gallery.publish.statusDraft', { defaultValue: 'Entwurf' })}
    </Badge>
  )
}

export interface TranslationStatusChipsProps {
  status?: DocCardMeta['translationStatus']
  /**
   * Optional: erwartete Locales (aus library.config.translations.targetLocales).
   * Wenn gesetzt, werden auch noch nicht enqueued Locales als „—" angezeigt,
   * sodass die Tabelle eine konsistente Spaltenbreite hat.
   */
  expectedLocales?: string[]
}

/**
 * Pro Locale ein farbiger Chip:
 *  - done    → green
 *  - pending → amber
 *  - failed  → red
 *  - (nicht enqueued) → muted/outline
 */
export function TranslationStatusChips({ status, expectedLocales }: TranslationStatusChipsProps) {
  const locales = new Set<string>([
    ...(expectedLocales ?? []),
    ...Object.keys(status ?? {}),
  ])
  if (locales.size === 0) return <span className='text-xs text-muted-foreground'>—</span>
  return (
    <div className='flex flex-wrap gap-1'>
      {Array.from(locales).map((loc) => {
        const s = status?.[loc]
        const variant: 'default' | 'secondary' | 'outline' | 'destructive' =
          s === 'done' ? 'default' : s === 'failed' ? 'destructive' : s === 'pending' ? 'secondary' : 'outline'
        return (
          <Badge key={loc} variant={variant} className='text-[10px] uppercase'>
            {loc}
          </Badge>
        )
      })}
    </div>
  )
}
