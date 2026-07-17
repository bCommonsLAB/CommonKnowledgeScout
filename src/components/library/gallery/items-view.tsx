'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ViewMode } from './gallery-sticky-header'
import { VirtualizedItemsView } from './virtualized-items-view'
import type { GalleryCardDensity } from '@/lib/gallery/gallery-card-density'
import type { GallerySumsState } from '@/hooks/gallery/use-gallery-sums'

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
  /** Quelle A: Per-Zeile-Trigger „Beziehungen berechnen" zeigen (Graph aktiv). */
  relationsEnabled?: boolean
  /**
   * Server sortiert bereits global nach Sternen, wenn `sortByStars` aktiv
   * ist (?sort=stars). Client-Sort entfaellt dann.
   */
  sortByStars?: boolean
  /** Globale Spalten-Sortierung (serverseitig): aktueller Zustand. */
  serverSort?: { column: string; dir: 'asc' | 'desc' } | null
  /** Spaltenkopf-Klicks sortieren serverseitig (asc -> desc -> aus). */
  onServerSortChange?: (next: { column: string; dir: 'asc' | 'desc' } | null) => void
  /**
   * Stern-Toggle: optimistischer Patch + POST. Wird von gallery-root
   * bereitgestellt; fehlt er, fallback nur API (ohne mutateDoc).
   */
  onToggleFavorite?: (fileId: string) => void | Promise<void>
  /** Stufe 4: Schwellwert fuer die Auto-Uebernahme im Klassifikations-Dialog. */
  autoApplyConfidenceThreshold?: number
  /** Stufe 4: Reload-Callback nach erfolgreichem Bulk-Apply. */
  onGroupClassified?: () => void
  /** Summen-Fusszeile (Table-Mode): Server-Aggregat ueber den gefilterten Bestand. */
  tableSums?: GallerySumsState | null
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
  relationsEnabled,
  sortByStars,
  serverSort,
  onServerSortChange,
  onToggleFavorite,
  autoApplyConfidenceThreshold,
  onGroupClassified,
  tableSums,
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
      relationsEnabled={relationsEnabled}
      sortByStars={sortByStars}
      serverSort={serverSort}
      onServerSortChange={onServerSortChange}
      onToggleFavorite={onToggleFavorite}
      autoApplyConfidenceThreshold={autoApplyConfidenceThreshold}
      onGroupClassified={onGroupClassified}
      tableSums={tableSums}
    />
  )
}

