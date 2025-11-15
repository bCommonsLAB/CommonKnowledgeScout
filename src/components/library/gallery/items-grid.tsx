'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import { DocumentCard } from './document-card'
import { useTranslation } from '@/lib/i18n/hooks'

export interface ItemsGridProps {
  docsByYear: Array<[number | string, DocCardMeta[]]>
  onOpen: (doc: DocCardMeta) => void
}

export function ItemsGrid({ docsByYear, onOpen }: ItemsGridProps) {
  const { t } = useTranslation()
  return (
    <div className='space-y-8'>
      {docsByYear.map(([year, yearDocs]) => (
        <div key={year}>
          <h3 className='text-lg font-semibold mb-4 pb-2 border-b pt-4'>
            {year === 'Ohne Jahrgang' ? t('gallery.noYear') : t('gallery.year', { year })}
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6'>
            {yearDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onClick={onOpen} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}














