'use client'

/**
 * src/components/library/gallery/document-card/standard-card.tsx
 *
 * Standard-Karte fuer alle Default-Typen (Buecher, Dokumente, etc.).
 *
 * Aus document-card.tsx ausgegliedert (Welle 3-III-a, Schritt 1/N).
 *
 * Layout:
 * - Card mit Cover-Thumbnail links + Titel/Description rechts
 * - Footer mit Authors, Region, Pages, Datum, Track-Badge
 * - Jahr-Badge oben rechts
 *
 * Verhalten 1:1 portiert — keine Logik-Aenderung.
 */

import React from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, User, FileText } from 'lucide-react'
import type { DocCardMeta } from '@/lib/gallery/types'
import { SpeakerOrAuthorIcons } from '../speaker-icons'
import { SourceStarsBadge } from '../source-stars-badge'

export interface StandardCardProps {
  doc: DocCardMeta
  onClick: () => void
  libraryId?: string
  onToggleFavorite?: (fileId: string) => void | Promise<void>
}

export function StandardCard({ doc, onClick, libraryId, onToggleFavorite }: StandardCardProps) {
  return (
    <Card
      className='cursor-pointer hover:shadow-lg transition-shadow duration-200 overflow-visible bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 relative'
      onClick={onClick}
    >
      <SourceStarsBadge
        libraryId={libraryId}
        fileId={doc.fileId}
        isFavorite={doc.isFavorite === true}
        favoriteCount={doc.favoriteCount}
        favoriteVoters={doc.favoriteVoters}
        onToggleFavorite={onToggleFavorite}
        variant='dark'
        className='absolute bottom-2 right-2 z-10'
      />
      <CardHeader className='relative pb-1'>
        {/* Jahr-Badge schwebend oben rechts, um mehr Breite fuer den Titel zu lassen */}
        {doc.year ? (
          <Badge variant='secondary' className='absolute top-2 right-3 text-xs px-2 py-0.5'>
            {String(doc.year)}
          </Badge>
        ) : null}

        <div className='flex items-start gap-3'>
          <div className='flex items-start gap-2 flex-1 min-w-0'>
            {/* Cover-Thumbnail + Speaker-Icons + Titel fuer Standard-Dokumente (Buecher, PDFs, etc.) */}
            {(doc.coverThumbnailUrl || doc.coverImageUrl) ? (
              <div className='flex-shrink-0 w-[80px] h-[120px] bg-secondary rounded border border-border overflow-hidden shadow-sm'>
                <Image
                  src={doc.coverThumbnailUrl || doc.coverImageUrl || ''}
                  alt={doc.title || doc.shortTitle || doc.fileName || 'Cover'}
                  width={80}
                  height={120}
                  className='w-full h-full object-cover'
                  loading='lazy'
                  unoptimized
                />
              </div>
            ) : null}
            <div className='flex-1 min-w-0'>
              <SpeakerOrAuthorIcons doc={doc} />
              <CardTitle className='text-lg line-clamp-2'>{doc.title || doc.shortTitle || doc.fileName || 'Dokument'}</CardTitle>
              <CardDescription className='line-clamp-2'>{doc.shortTitle || doc.fileName}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          {Array.isArray(doc.authors) && doc.authors.length > 0 ? (
            <div className='flex items-center text-sm text-muted-foreground'>
              <User className='h-2.5 w-2.5 mr-2' />
              <span className='line-clamp-2'>
                {doc.authors.join(', ')}
              </span>
            </div>
          ) : null}
          {doc.region ? (
            <div className='flex items-center text-sm text-muted-foreground'>
              <MapPin className='h-2.5 w-2.5 mr-2' />
              <span>{doc.region}</span>
            </div>
          ) : null}
          {doc.pages ? (
            <div className='flex items-center text-sm text-muted-foreground'>
              <FileText className='h-2.5 w-2.5 mr-2' />
              <span>{doc.pages} {doc.pages === 1 ? 'Seite' : 'Seiten'}</span>
            </div>
          ) : null}
          {doc.date ? (
            <div className='flex items-center justify-between text-sm text-muted-foreground'>
              <div className='flex items-center'>
                <Calendar className='h-2.5 w-2.5 mr-2' />
                <span>{new Date(doc.date).toLocaleDateString('de-DE')}</span>
              </div>
              {doc.track && (
                <Badge variant='outline' className='text-xs'>
                  {doc.trackLabel || doc.track}
                </Badge>
              )}
            </div>
          ) : doc.track ? (
            <div className='flex items-center justify-end text-sm text-muted-foreground'>
              <Badge variant='outline' className='text-xs'>
                {doc.trackLabel || doc.track}
              </Badge>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
