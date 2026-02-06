'use client'

import React from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, User, Check, X, Clock, HelpCircle, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocCardMeta } from '@/lib/gallery/types'
import { SpeakerOrAuthorIcons } from './speaker-icons'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { openDocumentBySlug } from '@/utils/document-navigation'

export interface DocumentCardProps {
  doc: DocCardMeta
  onClick?: (doc: DocCardMeta) => void // Optional: Fallback für Komponenten ohne slug
  libraryId?: string // Optional: Falls nicht vorhanden, wird onClick verwendet
  /** Fallback-DetailViewType aus der Library-Config (wenn doc.detailViewType nicht gesetzt ist) */
  libraryDetailViewType?: string
}

/**
 * Status-Konfiguration für ClimateAction (vereinfacht auf 4 Kategorien)
 * Mapping der lv_bewertung-Werte auf die 4 Status-Kategorien:
 * - aktiv (grün): in_umsetzung, im_klimaplan, in_fachplaenen, neu_umsetzbar
 * - geplant (gelb): vertieft_pruefen
 * - abgelehnt (rot): nicht_umsetzbar
 * - offen (grau): unklar, undefined
 */
type StatusColor = 'green' | 'yellow' | 'red' | 'gray'

interface StatusConfig {
  label: string
  shortLabel: string
  color: StatusColor
  icon: 'check' | 'clock' | 'x' | 'help-circle'
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  aktiv: { label: 'Aktiv', shortLabel: 'Aktiv', color: 'green', icon: 'check' },
  geplant: { label: 'Geplant', shortLabel: 'Geplant', color: 'yellow', icon: 'clock' },
  abgelehnt: { label: 'Abgelehnt', shortLabel: 'Abgelehnt', color: 'red', icon: 'x' },
  offen: { label: 'Offen', shortLabel: 'Offen', color: 'gray', icon: 'help-circle' },
}

// Mapping von lv_bewertung auf vereinfachte Status-Kategorien
function mapBewertungToStatus(bewertung?: string): string {
  if (!bewertung) return 'offen'
  switch (bewertung) {
    case 'in_umsetzung':
    case 'im_klimaplan':
    case 'in_fachplaenen':
    case 'neu_umsetzbar':
      return 'aktiv'
    case 'vertieft_pruefen':
      return 'geplant'
    case 'nicht_umsetzbar':
      return 'abgelehnt'
    case 'unklar':
    default:
      return 'offen'
  }
}

// Icon-Map für die Status-Symbole
const iconMap = {
  check: Check,
  clock: Clock,
  x: X,
  'help-circle': HelpCircle,
}

/**
 * ClimateAction-Karte im Sample-App-Stil:
 * - Hintergrundbild mit Gradient von oben UND unten
 * - OBEN: Kategorie (Handlungsfeld) + Titel
 * - UNTEN: Nummer links + Status-Badge rechts (Pill mit backdrop-blur)
 * - Hover-Effekte: Scale, Schatten, Linie unten
 */
function ClimateActionCard({ doc, onClick }: { doc: DocCardMeta; onClick: () => void }) {
  const status = mapBewertungToStatus(doc.lv_bewertung)
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.offen
  const IconComponent = iconMap[config.icon]
  
  // Thumbnail bevorzugen für Galerie-Performance, Fallback auf Original
  const displayImageUrl = doc.coverThumbnailUrl || doc.coverImageUrl
  
  return (
    <article
      className='group relative aspect-[4/3] overflow-hidden rounded-lg shadow-md transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer'
      onClick={onClick}
    >
      {/* Hintergrundbild: Thumbnail bevorzugt für bessere Performance */}
      {displayImageUrl ? (
        <Image
          src={displayImageUrl}
          alt={doc.title || doc.shortTitle || doc.fileName || 'Cover'}
          fill
          className='object-cover transition-transform duration-500 group-hover:scale-105'
          loading='lazy'
          unoptimized
        />
      ) : (
        // Fallback: Grüner Gradient wenn kein Bild vorhanden
        <div className='absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-600' />
      )}
      
      {/* Dezenter Gradient nur an den Rändern für bessere Lesbarkeit */}
      <div className='absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50' />
      
      {/* Content Container */}
      <div className='relative h-full flex flex-col justify-between p-4'>
        {/* OBEN: Kategorie + Titel */}
        <div>
          {/* Kategorie (z.B. Handlungsfeld bei Klimamaßnahmen) */}
          {doc.category && (
            <span className='block text-[10px] font-semibold uppercase tracking-widest text-white drop-shadow-lg'>
              {doc.category}
            </span>
          )}
          <h3 className='text-lg font-semibold leading-tight text-white text-balance pr-4 drop-shadow-lg'>
            {doc.title || doc.shortTitle || doc.fileName || 'Klimamaßnahme'}
          </h3>
        </div>
        
        {/* UNTEN: Nummer + Status */}
        <div className='flex items-end justify-between'>
          <span className='text-xs font-mono text-white drop-shadow-lg'>
            {doc.massnahme_nr ? `Nr. ${doc.massnahme_nr}` : '–'}
          </span>
          
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

export function DocumentCard({ doc, onClick, libraryId, libraryDetailViewType }: DocumentCardProps) {
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
  
  // Bestimme den effektiven DetailViewType: Dokument-spezifisch oder Library-Fallback
  const effectiveDetailViewType = doc.detailViewType || libraryDetailViewType
  
  // Spezielles Layout für ClimateAction
  if (effectiveDetailViewType === 'climateAction') {
    return <ClimateActionCard doc={doc} onClick={handleClick} />
  }
  
  // Standard-Layout für alle anderen Typen
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
            {/* Cover-Bild-Thumbnail: Thumbnail bevorzugt für bessere Performance */}
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
              {/* Kreisförmige Autoren-/Speaker-Icons nur anzeigen, wenn es echte Speaker-Bilder gibt (Logik in SpeakerOrAuthorIcons) */}
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














