'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import { DocumentCard } from './document-card'
import { useTranslation } from '@/lib/i18n/hooks'
import {
  itemsGridClassForDensity,
  type GalleryCardDensity,
} from '@/lib/gallery/gallery-card-density'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { GroupClassifyDialog } from './group-classify-dialog'

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
  /** Stern-Toggle (optimistisch wenn vom Root durchgereicht). */
  onToggleFavorite?: (fileId: string) => void | Promise<void>
  /**
   * Stufe 4: Schwellwert fuer die Auto-Uebernahme im Stoffgruppen-Klassifikations-
   * Dialog (Default 0.9). Wenn 0 oder negativ, wird der Library-Default verwendet.
   */
  autoApplyConfidenceThreshold?: number
  /**
   * Stufe 4: wird nach erfolgreichem Bulk-Apply (Stoffgruppe) oder nach
   * Per-Material-Korrektur (locked/rejected/Klasse) gefeuert, damit die Galerie
   * die neuen Klassifikations-Badges sieht.
   */
  onGroupClassified?: () => void
}

export function ItemsGrid({
  docsByYear,
  onOpen,
  libraryId,
  libraryDetailViewType,
  groupByField = 'year',
  cardDensity = 'comfortable',
  onToggleFavorite,
  autoApplyConfidenceThreshold,
  onGroupClassified,
}: ItemsGridProps) {
  const { t } = useTranslation()

  // Bei 'none' keine Gruppen-Header anzeigen
  const showGroupHeaders = groupByField !== 'none'

  // Stoffgruppen-Klassifikation (Stufe 4): nur sichtbar wenn nach group_name
  // gruppiert wird und ein libraryId vorhanden ist.
  const supportsGroupClassify =
    groupByField === 'group_name' && typeof libraryId === 'string' && libraryId.length > 0
  const [classifyGroupName, setClassifyGroupName] = React.useState<string | null>(null)
  const threshold =
    typeof autoApplyConfidenceThreshold === 'number' &&
    autoApplyConfidenceThreshold > 0 &&
    autoApplyConfidenceThreshold <= 1
      ? autoApplyConfidenceThreshold
      : 0.9

  return (
    // @container markiert dieses Element als Container Query Container
    <div className='space-y-10 @container'>
      {docsByYear.map(([groupKey, groupDocs], index) => (
        <div key={groupKey} className={index === 0 ? '' : 'pt-4'}>
          {/* Gruppen-Header nur anzeigen wenn gruppiert wird */}
          {showGroupHeaders && (
            <div className='mb-6 pb-2 border-b flex items-center justify-between gap-3'>
              <h3 className='text-xl font-semibold'>
                {groupByField === 'year'
                  ? (groupKey === 'Ohne Jahrgang' ? t('gallery.noYear') : t('gallery.year', { year: groupKey }))
                  : (groupKey === 'Ohne Zuordnung' ? t('gallery.noGroup') : String(groupKey))
                }
              </h3>
              {supportsGroupClassify && groupKey !== 'Ohne Zuordnung' ? (
                <Button
                  variant='outline'
                  size='sm'
                  className='gap-2'
                  onClick={() => setClassifyGroupName(String(groupKey))}
                  title='Vorhandene Pass-1-Klassifikation eines Repraesentativen auf die Mitglieder uebernehmen (kein LLM-Call)'
                >
                  <Sparkles className='h-4 w-4' />
                  Gruppe propagieren
                </Button>
              ) : null}
            </div>
          )}
          {/* Spalten aus Library-Config / Toggle: siehe itemsGridClassForDensity */}
          <div className={itemsGridClassForDensity(cardDensity)}>
            {groupDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onClick={onOpen}
                libraryId={libraryId}
                libraryDetailViewType={libraryDetailViewType}
                onToggleFavorite={onToggleFavorite}
                onClassificationChanged={onGroupClassified}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Stoffgruppen-Klassifikations-Dialog (Stufe 4). */}
      {supportsGroupClassify && classifyGroupName !== null && libraryId ? (
        <GroupClassifyDialog
          open={classifyGroupName !== null}
          onOpenChange={(next) => {
            if (!next) setClassifyGroupName(null)
          }}
          libraryId={libraryId}
          groupName={classifyGroupName}
          autoApplyConfidenceThreshold={threshold}
          onApplied={() => {
            onGroupClassified?.()
            setClassifyGroupName(null)
          }}
        />
      ) : null}
    </div>
  )
}














