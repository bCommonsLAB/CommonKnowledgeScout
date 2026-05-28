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
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { GroupClassifyDialog } from './group-classify-dialog'
import { toast } from '@/components/ui/use-toast'

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

  // Refresh-Filter + Bulk-Auto-Apply (Stufe 4)
  const [onlyRefresh, setOnlyRefresh] = React.useState(false)
  const [bulkBusy, setBulkBusy] = React.useState(false)

  const refreshCount = React.useMemo(
    () =>
      docsByYear.reduce(
        (sum, [, docs]) => sum + docs.filter((d) => d.needs_visual_refresh === true).length,
        0,
      ),
    [docsByYear],
  )

  const displayedDocsByYear = React.useMemo(() => {
    if (!onlyRefresh) return docsByYear
    return docsByYear
      .map(([key, docs]) => [key, docs.filter((d) => d.needs_visual_refresh === true)] as [number | string, DocCardMeta[]])
      .filter(([, docs]) => docs.length > 0)
  }, [docsByYear, onlyRefresh])

  // Repraesentative Konfidenz pro Gruppe — bestimmt, ob Bulk-Auto-Apply
  // die Gruppe verarbeitet. Wir nehmen die hoechste confidence_class in der
  // Gruppe, weil das der Wert des klassifizierten Repraesentativen ist.
  const eligibleBulkGroups = React.useMemo(() => {
    if (!supportsGroupClassify) return [] as string[]
    return docsByYear
      .filter(([key]) => key !== 'Ohne Zuordnung')
      .filter(([, docs]) => {
        const maxConfidence = docs.reduce((max, d) => {
          const c = typeof d.confidence_class === 'number' ? d.confidence_class : 0
          return c > max ? c : max
        }, 0)
        return maxConfidence >= threshold
      })
      .map(([key]) => String(key))
  }, [docsByYear, supportsGroupClassify, threshold])

  const handleBulkAutoApply = React.useCallback(async () => {
    if (!libraryId || eligibleBulkGroups.length === 0) return
    setBulkBusy(true)
    let appliedGroups = 0
    let failedGroups = 0
    let appliedMembers = 0
    let refreshedMembers = 0
    for (const groupName of eligibleBulkGroups) {
      try {
        const res = await fetch('/api/diva-texture/group-classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ libraryId, groupName, dryRun: false }),
        })
        if (!res.ok) {
          failedGroups += 1
          continue
        }
        const json = (await res.json()) as {
          members?: { applied?: string[]; markedForRefresh?: string[] }
        }
        appliedGroups += 1
        appliedMembers += json.members?.applied?.length ?? 0
        refreshedMembers += json.members?.markedForRefresh?.length ?? 0
      } catch {
        failedGroups += 1
      }
    }
    toast({
      title: 'Bulk-Auto-Apply abgeschlossen',
      description:
        `${appliedGroups} Gruppen propagiert (${appliedMembers} Mitglieder)` +
        (refreshedMembers > 0 ? `, ${refreshedMembers} mit needs_visual_refresh markiert` : '') +
        (failedGroups > 0 ? `, ${failedGroups} Gruppen fehlgeschlagen` : ''),
      variant: failedGroups > 0 ? 'destructive' : undefined,
    })
    onGroupClassified?.()
    setBulkBusy(false)
  }, [libraryId, eligibleBulkGroups, onGroupClassified])

  return (
    // @container markiert dieses Element als Container Query Container
    <div className='space-y-10 @container'>
      {/* DIVA-Toolbar (Stufe 4): Refresh-Filter + Bulk-Auto-Apply. Nur sichtbar
          bei Stoffgruppen-Gruppierung. */}
      {supportsGroupClassify ? (
        <div className='flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm'>
          <span className='text-muted-foreground'>
            DIVA-Texture · Schwellwert {Math.round(threshold * 100)}%
          </span>
          {refreshCount > 0 ? (
            <Button
              variant={onlyRefresh ? 'default' : 'outline'}
              size='sm'
              className='gap-2'
              onClick={() => setOnlyRefresh((v) => !v)}
              title='Nur Materialien mit needs_visual_refresh anzeigen — diese brauchen einen Korrektur-Lauf im Archiv'
            >
              <RefreshCw className='h-4 w-4' />
              {onlyRefresh ? 'Alle anzeigen' : `Nur refresh-Materialien (${refreshCount})`}
            </Button>
          ) : null}
          <Button
            variant='outline'
            size='sm'
            className='ml-auto gap-2'
            onClick={handleBulkAutoApply}
            disabled={bulkBusy || eligibleBulkGroups.length === 0}
            title={
              eligibleBulkGroups.length === 0
                ? 'Keine Gruppe erreicht den Schwellwert (' + Math.round(threshold * 100) + '%)'
                : `Alle ${eligibleBulkGroups.length} Gruppen ≥ ${Math.round(threshold * 100)}% propagieren (kein LLM-Call)`
            }
          >
            {bulkBusy ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Sparkles className='h-4 w-4' />
            )}
            Alle Gruppen propagieren ({eligibleBulkGroups.length})
          </Button>
        </div>
      ) : null}

      {displayedDocsByYear.map(([groupKey, groupDocs], index) => (
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














