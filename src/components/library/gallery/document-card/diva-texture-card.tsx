'use client'

/**
 * src/components/library/gallery/document-card/diva-texture-card.tsx
 *
 * DivaTextureCard fuer detailViewType='divaTexture'.
 *
 * Aus document-card.tsx ausgegliedert (Welle 3-III-a, Schritt 1/N).
 *
 * Quadratische Kachel mit Hintergrund aus Cover (Textur).
 * Galerie: coverThumbnailUrl zuerst (256x256 WebP, center-crop) —
 * sonst zieht die Karte mehrere MB Original-JPEGs pro Eintrag.
 * Detailansicht kann weiter das volle coverImageUrl nutzen.
 *
 * Verhalten 1:1 portiert — keine Logik-Aenderung.
 */

import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { DocCardMeta } from '@/lib/gallery/types'
import {
  coverRefNeedsApiResolution,
  resolveCoverUrlViaApi,
} from '@/lib/gallery/resolve-cover-url-client'
import { displayBasenameFromCoverRef } from '@/lib/gallery/cover-ref-display-name'
import { SourceStarsBadge } from '../source-stars-badge'

export interface DivaTextureCardProps {
  doc: DocCardMeta
  onClick: () => void
  libraryId?: string
  onToggleFavorite?: (fileId: string) => void | Promise<void>
}

export function DivaTextureCard({ doc, onClick, libraryId, onToggleFavorite }: DivaTextureCardProps) {
  const rawRef = doc.coverThumbnailUrl || doc.coverImageUrl
  const [displayImageUrl, setDisplayImageUrl] = useState<string | undefined>(() =>
    rawRef && !coverRefNeedsApiResolution(rawRef) ? rawRef : undefined
  )

  // Nur-Dateiname / relativer Verweis: ueber API in streaming-url
  // aufloesen (siehe Media-Lifecycle-Regel).
  useEffect(() => {
    const ref = doc.coverThumbnailUrl || doc.coverImageUrl
    if (!ref) {
      setDisplayImageUrl(undefined)
      return
    }
    if (!coverRefNeedsApiResolution(ref)) {
      setDisplayImageUrl(ref)
      return
    }
    // Lokale Kopien: TS narrowed `doc.fileId` nicht in async-Closures
    // zuverlaessig.
    const effectiveLibraryId = libraryId
    const effectiveFileId = doc.fileId
    if (!effectiveLibraryId || !effectiveFileId) {
      setDisplayImageUrl(undefined)
      return
    }
    let cancelled = false
    void (async () => {
      const resolved = await resolveCoverUrlViaApi({
        libraryId: effectiveLibraryId,
        fileId: effectiveFileId,
        coverRef: ref,
        // docMetaJson.sourceFileName: echte Quell-Textur (Shadow-Twin / resolve-binary-url)
        sourceFileName: doc.sourceFileName?.trim() || doc.fileName,
      })
      if (!cancelled) {
        setDisplayImageUrl(resolved ?? undefined)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [doc.coverImageUrl, doc.coverThumbnailUrl, doc.fileId, doc.fileName, doc.sourceFileName, libraryId])

  // Galerie: Primaerzeile = docMetaJson.sourceFileName (Quell-Textur),
  // sonst Cover-Basename, nicht zuerst .md-Dateiname.
  const sourceFile = doc.sourceFileName?.trim()
  const coverBasename =
    displayBasenameFromCoverRef(doc.coverImageUrl) ||
    displayBasenameFromCoverRef(doc.coverThumbnailUrl)
  const titleOrShort = (doc.title || doc.shortTitle)?.trim()
  const fileNameMd = doc.fileName?.trim()
  const primaryLine = sourceFile || coverBasename || titleOrShort || fileNameMd || 'Textur'
  const secondaryLine = (() => {
    const tc = doc.textur_code?.trim()
    if (sourceFile) {
      return (
        (titleOrShort && titleOrShort !== primaryLine ? titleOrShort : '') ||
        (tc && tc !== primaryLine ? tc : '') ||
        (coverBasename && coverBasename !== primaryLine ? coverBasename : '') ||
        (fileNameMd && fileNameMd !== primaryLine ? fileNameMd : '')
      )
    }
    if (coverBasename) {
      return (
        (titleOrShort && titleOrShort !== primaryLine ? titleOrShort : '') ||
        (tc && tc !== primaryLine ? tc : '') ||
        (fileNameMd && fileNameMd !== primaryLine ? fileNameMd : '')
      )
    }
    if (fileNameMd) {
      return (titleOrShort && titleOrShort !== primaryLine ? titleOrShort : '') || (tc || '')
    }
    return tc || ''
  })()
  const showSecondary =
    secondaryLine.length > 0 && secondaryLine !== primaryLine

  return (
    <article
      className='group relative flex flex-col aspect-square overflow-hidden rounded-lg border border-border/60 shadow-md transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer'
      onClick={onClick}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {displayImageUrl ? (
        <div
          className='absolute inset-0 bg-neutral-200 dark:bg-neutral-800'
          style={{
            backgroundImage: `url(${displayImageUrl})`,
            // 1:1 wie geliefert, kein kuenstliches Hoch-/Runterskalieren;
            // zentriert, Rand abschneiden bei groesseren Maps
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'auto',
            backgroundPosition: 'center',
          }}
        />
      ) : (
        <div className='absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900' />
      )}

      {/* Kein Verlauf ueber die gesamte Kachel — Textur bleibt unverfaelscht sichtbar. */}
      <div className='relative mt-auto flex flex-col justify-end'>
        <div
          className={cn(
            'px-2.5 py-2 sm:px-3 sm:py-2.5',
            // Nur unter dem Text: halbtransparente Blende, nicht ueber dem Musterbereich darueber
            // Sehr leichte Blende; Lesbarkeit primaer ueber Text-drop-shadow
            'rounded-b-lg bg-black/20 text-white',
          )}
        >
          <p className='text-xs sm:text-sm font-semibold leading-snug truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]' title={primaryLine}>
            {primaryLine}
          </p>
          {showSecondary ? (
            <p
              className={cn(
                'mt-0.5 leading-snug text-white/80 line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]',
                // ~halbe optische Groesse zum Dateinamen (dezenter Untertitel)
                'text-[10px] sm:text-[11px] font-normal',
                doc.textur_code && secondaryLine === doc.textur_code.trim() && 'font-mono',
              )}
              title={secondaryLine}
            >
              {secondaryLine}
            </p>
          ) : null}
        </div>
      </div>

      <SourceStarsBadge
        libraryId={libraryId}
        fileId={doc.fileId}
        isFavorite={doc.isFavorite === true}
        favoriteCount={doc.favoriteCount}
        favoriteVoters={doc.favoriteVoters}
        onToggleFavorite={onToggleFavorite}
        variant='light'
        className='absolute top-2 left-2 z-10'
      />

      <div className='absolute inset-x-0 bottom-0 h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left' />
    </article>
  )
}
