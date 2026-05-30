'use client'

/**
 * src/components/library/gallery/document-card/climate-action-card.tsx
 *
 * ClimateActionCard fuer detailViewType='climateAction'.
 *
 * Aus document-card.tsx ausgegliedert (Welle 3-III-a, Schritt 1/N).
 *
 * Sample-App-Stil:
 * - Hintergrundbild mit Gradient von oben UND unten
 * - OBEN: Kategorie (Handlungsfeld) + Titel
 * - UNTEN: Nummer links + Status-Badge rechts (Pill mit backdrop-blur)
 * - Hover-Effekte: Scale, Schatten, Linie unten
 *
 * Verhalten 1:1 portiert — keine Logik-Aenderung.
 */

import React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { DocCardMeta } from '@/lib/gallery/types'
import { mapBewertungToStatus, STATUS_CONFIG, STATUS_ICON_MAP } from './status-config'
import { SourceStarsBadge } from '../source-stars-badge'
import { SourceCommentsBadge } from '../source-comments-badge'

export interface ClimateActionCardProps {
  doc: DocCardMeta
  onClick: () => void
  libraryId?: string
  onToggleFavorite?: (fileId: string) => void | Promise<void>
}

export function ClimateActionCard({
  doc,
  onClick,
  libraryId,
  onToggleFavorite,
}: ClimateActionCardProps) {
  const status = mapBewertungToStatus(doc.lv_bewertung)
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.offen
  const IconComponent = STATUS_ICON_MAP[config.icon]

  // Thumbnail bevorzugen fuer Galerie-Performance, Fallback auf Original
  const displayImageUrl = doc.coverThumbnailUrl || doc.coverImageUrl

  return (
    <article
      className='group relative aspect-[4/3] overflow-hidden rounded-lg shadow-md transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer'
      onClick={onClick}
    >
      {/* Hintergrundbild: Thumbnail bevorzugt fuer bessere Performance */}
      {displayImageUrl ? (
        <Image
          src={displayImageUrl}
          alt={doc.shortTitle || doc.title || doc.fileName || 'Cover'}
          fill
          className='object-cover transition-transform duration-500 group-hover:scale-105'
          loading='lazy'
          unoptimized
        />
      ) : (
        // Fallback: Gruener Gradient wenn kein Bild vorhanden
        <div className='absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-600' />
      )}

      {/* Dezenter Gradient nur an den Raendern fuer bessere Lesbarkeit */}
      <div className='absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50' />

      {/* Content Container */}
      <div className='relative h-full flex flex-col justify-between p-4'>
        {/* OBEN: Kategorie + Titel */}
        <div>
          {/* Kategorie (z.B. Handlungsfeld bei Klimamassnahmen) */}
          {doc.category && (
            <span className='block text-[10px] font-semibold uppercase tracking-widest text-white drop-shadow-lg'>
              {/* Doc-Translations: zeige uebersetztes Label, behalte kanonischen Wert. */}
              {doc.categoryLabel || doc.category}
            </span>
          )}
          <h3 className='text-lg font-semibold leading-tight text-white text-balance pr-4 drop-shadow-lg'>
            {doc.shortTitle || doc.title || doc.fileName || 'Klimamassnahme'}
          </h3>
        </div>

        {/* UNTEN: Nummer + Sterne/Kommentare (links), Status (rechts) */}
        <div className='flex items-end justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <span className='text-xs font-mono text-white drop-shadow-lg'>
              {doc.massnahme_nr ? `Nr. ${doc.massnahme_nr}` : '–'}
            </span>
            {/* Rating-Badge (read-only): Perzentil bevorzugt, sonst Roh-Wert.
                "Kosten unbekannt" (rating === null) zeigt keinen Wert. */}
            {typeof doc.ratingPercentile === 'number' && (
              <span
                className='rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm'
                title='KI-Prioritäts-Score (0–100)'
              >
                ★ {doc.ratingPercentile}
              </span>
            )}
            <SourceStarsBadge
              libraryId={libraryId}
              fileId={doc.fileId}
              isFavorite={doc.isFavorite === true}
              favoriteCount={doc.favoriteCount}
              favoriteVoters={doc.favoriteVoters}
              onToggleFavorite={onToggleFavorite}
              variant='light'
            />
            <SourceCommentsBadge
              libraryId={libraryId}
              fileId={doc.fileId}
              commentCount={doc.commentCount}
              variant='light'
            />
          </div>

          {/* Status-Badge als Pill mit backdrop-blur */}
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm',
              config.color === 'green' && 'bg-green-600/90 text-white',
              config.color === 'yellow' && 'bg-amber-500/90 text-white',
              config.color === 'red' && 'bg-red-500/90 text-white',
              config.color === 'gray' && 'bg-gray-500/90 text-white'
            )}
          >
            <IconComponent className='w-3.5 h-3.5' />
            <span className='hidden sm:inline'>{config.shortLabel}</span>
          </div>
        </div>
      </div>

      {/* Hover-Linie unten */}
      <div className='absolute inset-x-0 bottom-0 h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left' />
    </article>
  )
}
