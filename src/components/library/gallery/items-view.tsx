'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ViewMode } from './gallery-sticky-header'
import { VirtualizedItemsView } from './virtualized-items-view'
import type { GalleryCardDensity } from '@/lib/gallery/gallery-card-density'

export interface ItemsViewProps {
  /** View-Mode: 'grid' für Galerie-Ansicht, 'table' für Tabellen-Ansicht */
  viewMode: ViewMode
  /** Dokumente gruppiert nach Jahr oder anderem Feld */
  docsByYear: Array<[number | string, DocCardMeta[]]>
  /** Callback für Dokument-Öffnen (optional: Fallback für Dokumente ohne slug) */
  onOpen?: (doc: DocCardMeta) => void
  /** Library ID (optional: Für URL-basierte Navigation) */
  libraryId?: string
  /** Pagination: Mehr laden */
  onLoadMore?: () => void
  /** Pagination: Gibt es mehr zu laden? */
  hasMore?: boolean
  /** Pagination: Lade-Status */
  isLoadingMore?: boolean
  /** Callback nach erfolgreichem Löschen eines Dokuments */
  onDocumentDeleted?: () => void
  /** Fallback-DetailViewType aus der Library-Config */
  libraryDetailViewType?: string
  /** Gruppierungsfeld: 'year', 'none', oder ein Facetten-Key (z.B. 'category') */
  groupByField?: string
  /** Facetten mit showInTable=true – bestimmen die Tabellenspalten (außer Titel/UpsertedAt) */
  tableColumnFacets?: Array<{ metaKey: string; label?: string }>
  cardDensity?: GalleryCardDensity
  /** Doc-Translations Refactor: erwartete Ziel-Locales fuer Sprachen-Spalte */
  expectedTargetLocales?: string[]
  /** Doc-Translations Refactor: Reload-Callback nach Publish/Unpublish/Re-translate */
  onPublishChanged?: () => void
}

/**
 * Wrapper-Komponente mit virtuellem Scrolling und Infinite Scroll
 * Lädt automatisch weitere Dokumente beim Scrollen
 */
export function ItemsView({
  viewMode,
  docsByYear,
  onOpen,
  libraryId,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onDocumentDeleted,
  libraryDetailViewType,
  groupByField,
  tableColumnFacets,
  cardDensity = 'comfortable',
  expectedTargetLocales,
  onPublishChanged,
}: ItemsViewProps) {
  return (
    <VirtualizedItemsView
      viewMode={viewMode}
      docsByYear={docsByYear}
      onOpen={onOpen}
      libraryId={libraryId}
      onLoadMore={onLoadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onDocumentDeleted={onDocumentDeleted}
      libraryDetailViewType={libraryDetailViewType}
      groupByField={groupByField}
      tableColumnFacets={tableColumnFacets}
      cardDensity={cardDensity}
      expectedTargetLocales={expectedTargetLocales}
      onPublishChanged={onPublishChanged}
    />
  )
}

