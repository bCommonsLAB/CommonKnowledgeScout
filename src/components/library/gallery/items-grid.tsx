'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import { DocumentCard } from './document-card'
import { useTranslation } from '@/lib/i18n/hooks'
import {
  itemsGridClassForDensity,
  type GalleryCardDensity,
} from '@/lib/gallery/gallery-card-density'

export interface ItemsGridProps {
  docsByYear: Array<[number | string, DocCardMeta[]]>
  onOpen?: (doc: DocCardMeta) => void // Optional: Fallback für Dokumente ohne slug
  libraryId?: string // Optional: Für URL-basierte Navigation
  /** Fallback-DetailViewType aus der Library-Config */
  libraryDetailViewType?: string
  /** Gruppierungsfeld: 'year', 'none', oder ein Facetten-Key (z.B. 'category') */
  groupByField?: string
  /** Karten-Raster: kompakt vs. komfortabel (Default: comfortable) */
  cardDensity?: GalleryCardDensity
}

export function ItemsGrid({
  docsByYear,
  onOpen,
  libraryId,
  libraryDetailViewType,
  groupByField = 'year',
  cardDensity = 'comfortable',
}: ItemsGridProps) {
  const { t } = useTranslation()
  
  // Bei 'none' keine Gruppen-Header anzeigen
  const showGroupHeaders = groupByField !== 'none'
  
  return (
    // @container markiert dieses Element als Container Query Container
    <div className='space-y-10 @container'>
      {docsByYear.map(([groupKey, groupDocs], index) => (
        <div key={groupKey} className={index === 0 ? '' : 'pt-4'}>
          {/* Gruppen-Header nur anzeigen wenn gruppiert wird */}
          {showGroupHeaders && (
            <h3 className='text-xl font-semibold mb-6 pb-2 border-b'>
              {groupByField === 'year' 
                ? (groupKey === 'Ohne Jahrgang' ? t('gallery.noYear') : t('gallery.year', { year: groupKey }))
                : (groupKey === 'Ohne Zuordnung' ? t('gallery.noGroup') : String(groupKey))
              }
            </h3>
          )}
          {/* Spalten aus Library-Config / Toggle: siehe itemsGridClassForDensity */}
          <div className={itemsGridClassForDensity(cardDensity)}>
            {groupDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onClick={onOpen} libraryId={libraryId} libraryDetailViewType={libraryDetailViewType} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}














