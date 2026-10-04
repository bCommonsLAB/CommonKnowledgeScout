'use client'

/**
 * Kopf der Detailansicht (D6b aus `detail-overlay.tsx` gezogen, Verhalten
 * 1:1): Titel mit Pfeil-Navigation, Stern, Kommentar-Knopf, Original-Link
 * (Sessions), Schliessen; darunter Teilen, „In Story Mode ansehen" und die
 * Leiste des Bewertungsmodus (Member mit Geschwister-Liste).
 */

import { X, ExternalLink, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { SourceStarsCell } from '../source-stars-cell'
import { RatingModeBar } from '../rating/rating-mode-bar'
import { SwitchToStoryModeButton } from '../switch-to-story-mode-button'
import { DocumentShareButton } from '../document-share-button'
import type { DocCardMeta } from '../../lib/types'
import type { DetailOverlayProps } from './types'
import type { useBewertung } from './use-bewertung'

export interface DetailKopfProps
  extends Pick<DetailOverlayProps, 'libraryId' | 'fileId' | 'viewType' | 'doc' | 'storyModusVerfuegbar' | 'currentMode' | 'isSwitchingRef' | 'siblingDocs' | 'onNavigateToDoc' | 'onClose'> {
  displayTitle: string
  isMember: boolean
  isSignedIn: boolean
  sessionUrl: string | null
  bewertung: ReturnType<typeof useBewertung>
  onScrollToComments: () => void
}

function pfeilTitel(doc: DocCardMeta | null): string | undefined {
  return doc?.shortTitle || doc?.title || doc?.fileName
}

export function DetailKopf(p: DetailKopfProps) {
  const { t } = useTranslation()
  const b = p.bewertung
  const starMeta = b.starMeta
  return (
    <div className='flex flex-col gap-3 p-6 border-b shrink-0'>
      <div className='flex items-center justify-between gap-4'>
        <div className='flex items-center gap-2 min-w-0 flex-1'>
          {/* Pfeil-Navigation: vorheriges Dokument */}
          {p.onNavigateToDoc && (
            <Button
              variant='ghost'
              size='icon'
              type='button'
              disabled={!b.effectivePrevDoc}
              onClick={(e) => {
                e.stopPropagation()
                if (b.effectivePrevDoc) p.onNavigateToDoc?.(b.effectivePrevDoc)
              }}
              aria-label={t('gallery.detail.previous', { defaultValue: 'Vorheriges Dokument' })}
              title={pfeilTitel(b.effectivePrevDoc)}
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
          )}
          <h2 className='text-xl font-semibold truncate'>{p.displayTitle}</h2>
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          {/* Sterne-Cell: eigener Stern + Counter + Tooltip (Member-only). */}
          {p.isMember && p.fileId && (
            <SourceStarsCell
              libraryId={p.libraryId}
              fileId={p.fileId}
              isFavorite={starMeta?.isFavorite === true}
              count={starMeta?.favoriteCount ?? 0}
              voters={starMeta?.favoriteVoters ?? []}
              onToggleFavorite={b.handleToggleFavorite}
              size='md'
            />
          )}
          {/* Kommentar-Button: springt zur Kommentar-Sektion unten (mit Counter). */}
          {p.isSignedIn && p.fileId && (
            <Button
              variant='ghost'
              size='sm'
              type='button'
              onClick={(e) => { e.stopPropagation(); p.onScrollToComments() }}
              className='gap-1 text-xs'
              title={t('gallery.comments.sectionTitle', { defaultValue: 'Kommentare' })}
            >
              <MessageCircle className='h-4 w-4' aria-hidden />
              {typeof starMeta?.commentCount === 'number' && starMeta.commentCount > 0 ? (
                <span className='tabular-nums'>{starMeta.commentCount}</span>
              ) : null}
            </Button>
          )}
          {/* Link zur Original-Webseite (nur fuer Sessions mit URL) */}
          {p.viewType === 'session' && p.sessionUrl && (
            <Button variant='ghost' size='sm' asChild className='text-xs'>
              <a href={p.sessionUrl} target='_blank' rel='noopener noreferrer' className='flex items-center gap-1'>
                <ExternalLink className='h-3 w-3' />
                <span>{t('gallery.linkToOriginalWebsite')}</span>
              </a>
            </Button>
          )}
          {/* Pfeil-Navigation: naechstes Dokument */}
          {p.onNavigateToDoc && (
            <Button
              variant='ghost'
              size='icon'
              type='button'
              disabled={!b.effectiveNextDoc}
              onClick={(e) => {
                e.stopPropagation()
                if (b.effectiveNextDoc) p.onNavigateToDoc?.(b.effectiveNextDoc)
              }}
              aria-label={t('gallery.detail.next', { defaultValue: 'Naechstes Dokument' })}
              title={pfeilTitel(b.effectiveNextDoc)}
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          )}
          <Button variant='ghost' size='icon' onClick={(e) => { e.stopPropagation(); p.onClose() }}>
            <X className='h-4 w-4' />
          </Button>
        </div>
      </div>

      {/* Share + Story-Mode (rechts) und darunter der Bewertungsmodus. */}
      {p.doc && (
        <div className='flex flex-col gap-2'>
          <div className='flex items-center gap-2 flex-wrap'>
            <div className='ml-auto flex items-center gap-2'>
              <DocumentShareButton doc={p.doc} title={p.displayTitle} />
              {p.storyModusVerfuegbar ? (
                <SwitchToStoryModeButton
                  doc={p.doc}
                  currentMode={p.currentMode ?? 'gallery'}
                  onClose={p.onClose}
                  isSwitchingRef={p.isSwitchingRef}
                />
              ) : null}
            </div>
          </div>
          {/* Bewertungsmodus ist Member-only und braucht eine Geschwister-
              Liste, sonst macht das Durchgehen keinen Sinn. */}
          {p.isMember && Array.isArray(p.siblingDocs) && p.siblingDocs.length > 1 ? (
            <RatingModeBar
              active={b.ratingActive}
              onChange={b.setRatingActive}
              onlyUnrated={b.onlyUnrated}
              onChangeOnlyUnrated={b.setOnlyUnrated}
              total={b.sequencer.total}
              index={b.sequencer.index}
              unratedCount={b.sequencer.unratedCount}
              favoriteCount={b.sequencer.favoriteCount}
              notImportantCount={b.sequencer.notImportantCount}
              onRateImportant={b.handleRateImportant}
              onRateNotImportant={b.handleRateNotImportant}
              isCurrentFavorite={starMeta?.isFavorite === true}
              isCurrentNotImportant={p.fileId ? b.isNotImportant(p.fileId) : false}
              disabled={!p.fileId}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
