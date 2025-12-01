'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ViewMode } from './gallery-sticky-header'
import { VirtualizedItemsView } from './virtualized-items-view'

export interface ItemsViewProps {
  /** View-Mode: 'grid' für Galerie-Ansicht, 'table' für Tabellen-Ansicht */
  viewMode: ViewMode
  /** Dokumente gruppiert nach Jahr */
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
}

/**
 * Wrapper-Komponente mit virtuellem Scrolling und Infinite Scroll
 * Lädt automatisch weitere Dokumente beim Scrollen
 */
export function ItemsView({ viewMode, docsByYear, onOpen, libraryId, onLoadMore, hasMore, isLoadingMore }: ItemsViewProps) {
  return (
    <VirtualizedItemsView
      viewMode={viewMode}
      docsByYear={docsByYear}
      onOpen={onOpen}
      libraryId={libraryId}
      onLoadMore={onLoadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
    />
  )
}

