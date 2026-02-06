'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import { DocumentCard } from './document-card'
import { useTranslation } from '@/lib/i18n/hooks'

export interface ItemsGridProps {
  docsByYear: Array<[number | string, DocCardMeta[]]>
  onOpen?: (doc: DocCardMeta) => void // Optional: Fallback für Dokumente ohne slug
  libraryId?: string // Optional: Für URL-basierte Navigation
  /** Fallback-DetailViewType aus der Library-Config */
  libraryDetailViewType?: string
  /** Gruppierungsfeld: 'year', 'none', oder ein Facetten-Key (z.B. 'category') */
  groupByField?: string
}

export function ItemsGrid({ docsByYear, onOpen, libraryId, libraryDetailViewType, groupByField = 'year' }: ItemsGridProps) {
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
          {/* Container Queries: Spalten basierend auf Container-Breite, nicht Viewport-Breite
              Konservative Breakpoints für bessere Lesbarkeit:
              @lg = 512px, @4xl = 896px, @6xl = 1152px, @7xl = 1280px */}
          <div className='grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4 @7xl:grid-cols-5 gap-4'>
            {groupDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onClick={onOpen} libraryId={libraryId} libraryDetailViewType={libraryDetailViewType} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}














