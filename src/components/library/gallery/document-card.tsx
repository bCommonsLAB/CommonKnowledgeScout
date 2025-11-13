'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, User } from 'lucide-react'
import type { DocCardMeta } from '@/lib/gallery/types'
import { SpeakerOrAuthorIcons } from './speaker-icons'

export interface DocumentCardProps {
  doc: DocCardMeta
  onClick: (doc: DocCardMeta) => void
}

export function DocumentCard({ doc, onClick }: DocumentCardProps) {
  return (
    <Card
      className='cursor-pointer hover:shadow-lg transition-shadow duration-200 overflow-visible bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20'
      onClick={() => onClick(doc)}
    >
      <CardHeader className='relative'>
        <div className='flex items-start justify-between'>
          <SpeakerOrAuthorIcons doc={doc} />
          {doc.year ? <Badge variant='secondary'>{String(doc.year)}</Badge> : null}
        </div>
        <CardTitle className='text-lg line-clamp-2'>{doc.shortTitle || doc.title || doc.fileName || 'Dokument'}</CardTitle>
        <CardDescription className='line-clamp-2'>{doc.title || doc.fileName}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          {Array.isArray(doc.authors) && doc.authors.length > 0 ? (
            <div className='flex items-center text-sm text-muted-foreground'>
              <User className='h-2.5 w-2.5 mr-2' />
              <span className='line-clamp-1'>
                {doc.authors[0]}
                {doc.authors.length > 1 ? ` +${doc.authors.length - 1} weitere` : ''}
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







