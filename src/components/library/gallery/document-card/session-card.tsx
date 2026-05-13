'use client'

/**
 * src/components/library/gallery/document-card/session-card.tsx
 *
 * SessionCard fuer detailViewType='session'.
 *
 * Aus document-card.tsx ausgegliedert (Welle 3-III-a, Schritt 1/N).
 *
 * YouTube-artiges Layout:
 * - Vollflaechiges Hintergrundbild (coverImage) mit Gradient-Overlay
 * - OBEN: Kurztitel + Sprecher + Organisation
 * - UNTEN: Datum links + Track-Badge rechts
 * - Hover-Effekte: Scale, Schatten, Linie unten
 * - Fallback ohne Bild: Blau-Cyan Gradient
 *
 * Verhalten 1:1 portiert — keine Logik-Aenderung.
 */

import React from 'react'
import Image from 'next/image'
import { Calendar } from 'lucide-react'
import type { DocCardMeta } from '@/lib/gallery/types'
import { SpeakerOrAuthorIcons } from '../speaker-icons'
import { SourceStarsBadge } from '../source-stars-badge'

export interface SessionCardProps {
  doc: DocCardMeta
  onClick: () => void
  libraryId?: string
  onToggleFavorite?: (fileId: string) => void | Promise<void>
}

export function SessionCard({ doc, onClick, libraryId, onToggleFavorite }: SessionCardProps) {
  // Thumbnail bevorzugen fuer Galerie-Performance, Fallback auf Original
  const displayImageUrl = doc.coverThumbnailUrl || doc.coverImageUrl

  // Sprecher-Namen als kommagetrennte Liste
  const speakerNames = Array.isArray(doc.speakers) && doc.speakers.length > 0
    ? doc.speakers.join(', ')
    : undefined

  // Datum formatieren (falls vorhanden)
  const formattedDate = doc.date
    ? new Date(doc.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' })
    : undefined

  return (
    <article
      className='group relative aspect-[16/9] overflow-hidden rounded-lg shadow-md transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer'
      onClick={onClick}
    >
      {/* Hintergrundbild: Thumbnail bevorzugt fuer bessere Performance */}
      {displayImageUrl ? (
        <Image
          src={displayImageUrl}
          alt={doc.shortTitle || doc.title || doc.fileName || 'Session'}
          fill
          className='object-cover transition-transform duration-500 group-hover:scale-105'
          loading='lazy'
          unoptimized
        />
      ) : (
        // Fallback: Blau-Cyan Gradient wenn kein Bild vorhanden
        <div className='absolute inset-0 bg-gradient-to-br from-blue-400 to-cyan-600' />
      )}

      {/* Blende: Sehr dezent, damit das Cover klarer sichtbar bleibt */}
      <div className='absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/30' />

      {/* Content Container */}
      <div className='relative h-full flex flex-col justify-between p-4'>
        {/* OBEN: Titel + Sprecher-Namen */}
        <div className='pr-8'>
          <h3 className='text-lg font-semibold leading-tight text-white drop-shadow-lg line-clamp-2'>
            {doc.shortTitle || doc.title || doc.fileName || 'Session'}
          </h3>
          {speakerNames && (
            <p className='text-sm text-white/90 mt-1 drop-shadow-lg line-clamp-1'>
              {speakerNames}
            </p>
          )}
        </div>

        {/* UNTEN: Speaker-Icons + Datum/Track */}
        <div className='flex flex-col gap-1'>
          <SpeakerOrAuthorIcons doc={doc} compact />
          <div className='flex items-end justify-between'>
            <span className='text-xs text-white/80 drop-shadow-lg flex items-center gap-1'>
              {formattedDate && (
                <>
                  <Calendar className='w-3 h-3' />
                  {formattedDate}
                </>
              )}
            </span>
            {doc.track && (
              <div className='flex items-center rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm bg-white/20 text-white'>
                {doc.trackLabel || doc.track}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Jahr-Badge oben rechts */}
      {doc.year && (
        <div className='absolute top-3 right-3 rounded-full px-2 py-0.5 text-xs font-semibold backdrop-blur-sm bg-black/30 text-white'>
          {String(doc.year)}
        </div>
      )}

      <SourceStarsBadge
        libraryId={libraryId}
        fileId={doc.fileId}
        isFavorite={doc.isFavorite === true}
        favoriteCount={doc.favoriteCount}
        favoriteVoters={doc.favoriteVoters}
        onToggleFavorite={onToggleFavorite}
        variant='light'
        className='absolute top-3 left-3 z-10'
      />

      {/* Hover-Linie unten */}
      <div className='absolute inset-x-0 bottom-0 h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left' />
    </article>
  )
}
