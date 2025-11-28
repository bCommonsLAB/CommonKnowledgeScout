'use client'

import React from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, User } from 'lucide-react'
import type { DocCardMeta } from '@/lib/gallery/types'
import { SpeakerOrAuthorIcons } from './speaker-icons'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { openDocumentBySlug } from '@/utils/document-navigation'

export interface DocumentCardProps {
  doc: DocCardMeta
  onClick?: (doc: DocCardMeta) => void // Optional: Fallback für Komponenten ohne slug
  libraryId?: string // Optional: Falls nicht vorhanden, wird onClick verwendet
}

export function DocumentCard({ doc, onClick, libraryId }: DocumentCardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const handleClick = () => {
    // Verwende zentrale Utility-Funktion wenn slug vorhanden ist
    if (doc.slug && libraryId) {
      openDocumentBySlug(doc.slug, libraryId, router, pathname, searchParams)
    } else if (onClick) {
      // Fallback: Verwende onClick-Callback wenn kein slug vorhanden
      onClick(doc)
    } else {
      console.warn('[DocumentCard] Kein slug oder onClick-Callback verfügbar:', doc)
    }
  }
  
  return (
    <Card
      className='cursor-pointer hover:shadow-lg transition-shadow duration-200 overflow-visible bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20'
      onClick={handleClick}
    >
      <CardHeader className='relative pb-1'>
        {/* Jahr-Badge schwebend oben rechts, um mehr Breite für den Titel zu lassen */}
        {doc.year ? (
          <Badge variant='secondary' className='absolute top-2 right-3 text-xs px-2 py-0.5'>
            {String(doc.year)}
          </Badge>
        ) : null}

        <div className='flex items-start gap-3'>
          <div className='flex items-start gap-2 flex-1 min-w-0'>
            {/* Cover-Bild-Thumbnail (falls vorhanden) */}
            {doc.coverImageUrl ? (
              <div className='flex-shrink-0 w-[80px] h-[120px] bg-secondary rounded border border-border overflow-hidden shadow-sm'>
                <Image
                  src={doc.coverImageUrl}
                  alt={doc.shortTitle || doc.title || doc.fileName || 'Cover'}
                  width={80}
                  height={120}
                  className='w-full h-full object-cover'
                  unoptimized
                />
              </div>
            ) : null}
            <div className='flex-1 min-w-0'>
              {/* Kreisförmige Autoren-/Speaker-Icons nur anzeigen, wenn es echte Speaker-Bilder gibt (Logik in SpeakerOrAuthorIcons) */}
              <SpeakerOrAuthorIcons doc={doc} />
              <CardTitle className='text-lg line-clamp-2'>{doc.shortTitle || doc.title || doc.fileName || 'Dokument'}</CardTitle>
              <CardDescription className='line-clamp-2'>{doc.title || doc.fileName}</CardDescription>
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
          {doc.date ? (
            <div className='flex items-center justify-between text-sm text-muted-foreground'>
              <div className='flex items-center'>
                <Calendar className='h-2.5 w-2.5 mr-2' />
                <span>{new Date(doc.date).toLocaleDateString('de-DE')}</span>
              </div>
              {doc.track && (
                <Badge variant='outline' className='text-xs'>
                  {doc.track}
                </Badge>
              )}
            </div>
          ) : doc.track ? (
            <div className='flex items-center justify-end text-sm text-muted-foreground'>
              <Badge variant='outline' className='text-xs'>
                {doc.track}
              </Badge>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}














