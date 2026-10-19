'use client'

/**
 * Kompakte Kachel der Klima-Karte (Owner-Befund 19.10.2026: Galerie zu dicht,
 * Schrift zu gross, Fusszeile bei 200 px abgeschnitten).
 *
 * Greift, wenn das Raster `cardDensity='compact'` meldet (5–7 Spalten) und im
 * Website-Banner (3 Spalten). Bewusst eine Prop statt einer Container-Query:
 * die komfortable Galerie liegt bei 5 Spalten selbst bei ~245 px Breite und
 * wuerde unter einer Breiten-Schwelle mit umkippen.
 *
 * Zeigt nur: Titel (hoechstens drei Zeilen), Status als farbiger Punkt mit
 * Text im Tooltip, Sterne-Zahl (ADR 0012). Nr., Prio und Kommentare stehen in
 * der komfortablen Form und in der Detailansicht.
 */

import React from 'react'
import { useGalleryHost } from '../../contexts/gallery-host-context'
import { cn } from '@ks/util'
import type { DocCardMeta } from '../../lib/types'
import { useTranslation } from '@ks/i18n/react'
import { belegKonfig, plaketteFuer } from '../beleg-liste/helpers'
import { PLAKETTE_SYMBOL, plaketteLabelKey } from '../beleg-liste/plakette'
import { SourceStarsBadge } from '../source-stars-badge'
import { PLAKETTE_KARTE, PLAKETTE_ROH } from './climate-action-plakette'

export interface ClimateActionCardCompactProps {
  doc: DocCardMeta
  onClick: () => void
  libraryId?: string
  onToggleFavorite?: (fileId: string) => void | Promise<void>
}

export function ClimateActionCardCompact({
  doc,
  onClick,
  libraryId,
  onToggleFavorite,
}: ClimateActionCardCompactProps) {
  const { Bild } = useGalleryHost()
  const { t } = useTranslation()
  const plakette = plaketteFuer(belegKonfig('climateAction'), doc)
  const displayImageUrl = doc.coverThumbnailUrl || doc.coverImageUrl
  const titel = doc.shortTitle || doc.title || doc.fileName || 'Klimamassnahme'

  // Status-Text fuer Tooltip und Screenreader: Label der Plakette oder der rohe Wert.
  const statusText = plakette
    ? plakette.art === 'plakette'
      ? t(plaketteLabelKey(plakette.plakette))
      : plakette.wert
    : null

  return (
    <article
      className='group relative aspect-[4/3] overflow-hidden bg-muted rounded-lg shadow-md transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer @container'
      onClick={onClick}
      data-density='compact'
    >
      {displayImageUrl ? (
        <Bild
          src={displayImageUrl}
          alt={titel}
          fill
          className='object-cover transition-transform duration-500 group-hover:scale-105'
          loading='lazy'
          unoptimized
        />
      ) : (
        <div className='absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-600' />
      )}

      {/* Verlauf nur unten; der Titel oben traegt seinen Schatten selbst. */}
      <div className='absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 via-black/20 to-transparent' />

      <div className='relative h-full flex flex-col justify-between p-3'>
        {/* Schmale Kachel text-sm, breite Banner-Karte (ab 260 px) text-base; Schatten statt Verlauf oben. */}
        <h3 className='text-sm @[260px]:text-base font-semibold leading-snug text-white line-clamp-3 [text-shadow:0_1px_2px_rgba(0,0,0,.9),0_0_10px_rgba(0,0,0,.5)]'>
          {titel}
        </h3>

        {/* Fusszeile: Status-Punkt links, Sterne rechts — nichts bricht um. */}
        <div className='flex items-center justify-between gap-2 flex-nowrap min-w-0'>
          {plakette && statusText && (
            <span
              className={cn(
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full backdrop-blur-sm',
                plakette.art === 'plakette' ? PLAKETTE_KARTE[plakette.plakette] : PLAKETTE_ROH,
              )}
              title={statusText}
              aria-label={statusText}
              role='img'
            >
              {plakette.art === 'plakette' && (() => { const Symbol = PLAKETTE_SYMBOL[plakette.plakette]; return <Symbol className='h-3 w-3' aria-hidden /> })()}
            </span>
          )}
          <SourceStarsBadge
            className='ml-auto'
            libraryId={libraryId}
            fileId={doc.fileId}
            isFavorite={doc.isFavorite === true}
            favoriteCount={doc.favoriteCount}
            favoriteVoters={doc.favoriteVoters}
            onToggleFavorite={onToggleFavorite}
            variant='light'
            size='compact'
          />
        </div>
      </div>

      <div className='absolute inset-x-0 bottom-0 h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left' />
    </article>
  )
}
