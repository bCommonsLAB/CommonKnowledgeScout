'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ChatResponse } from '@/types/chat-response'
import type { QueryLog } from '@/types/query-log'
import { GroupedItemsGrid } from './grouped-items-grid'
import { GroupedItemsTable } from './grouped-items-table'
import type { ViewMode } from './gallery-sticky-header'

export interface GroupedItemsViewProps {
  /** View-Mode: 'grid' für Galerie-Ansicht, 'table' für Tabellen-Ansicht */
  viewMode: ViewMode
  /** Callback für View-Mode-Änderung */
  onViewModeChange?: (mode: ViewMode) => void
  /** Dokumente, die in der Antwort verwendet wurden */
  usedDocs: DocCardMeta[]
  /** Dokumente, die gefunden wurden, aber nicht verwendet wurden */
  unusedDocs: DocCardMeta[]
  /** Referenzen für verwendete Dokumente */
  references: ChatResponse['references']
  /** Sources für nicht verwendete Dokumente */
  sources?: QueryLog['sources']
  /** QueryId zum Laden der Sources */
  queryId?: string
  /** LibraryId */
  libraryId: string
  /** Callback für Dokument-Öffnen (optional: Fallback für Dokumente ohne slug) */
  onOpenDocument?: (doc: DocCardMeta) => void
  /** Callback für Schließen (z.B. im ReferencesSheet, um das Sheet zu schließen) */
  onClose?: () => void
  /** Fallback-DetailViewType aus der Library-Config */
  libraryDetailViewType?: string
}

/**
 * Wrapper-Komponente für GroupedItemsGrid und GroupedItemsTable
 * Wählt automatisch die richtige Komponente basierend auf viewMode
 */
export function GroupedItemsView({
  viewMode,
  onViewModeChange,
  usedDocs,
  unusedDocs,
  references,
  sources,
  queryId,
  libraryId,
  onOpenDocument,
  onClose,
  libraryDetailViewType,
}: GroupedItemsViewProps) {
  if (viewMode === 'table') {
    return (
      <GroupedItemsTable
        usedDocs={usedDocs}
        unusedDocs={unusedDocs}
        references={references}
        sources={sources}
        queryId={queryId}
        libraryId={libraryId}
        onOpenDocument={onOpenDocument}
        onClose={onClose}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />
    )
  }
  return (
    <GroupedItemsGrid
      usedDocs={usedDocs}
      unusedDocs={unusedDocs}
      references={references}
      sources={sources}
      queryId={queryId}
      libraryId={libraryId}
      onOpenDocument={onOpenDocument}
      onClose={onClose}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      libraryDetailViewType={libraryDetailViewType}
    />
  )
}

