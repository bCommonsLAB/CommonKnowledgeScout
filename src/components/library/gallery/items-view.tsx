'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import { ItemsGrid } from './items-grid'
import { ItemsTable } from './items-table'
import type { ViewMode } from './gallery-sticky-header'

export interface ItemsViewProps {
  /** View-Mode: 'grid' für Galerie-Ansicht, 'table' für Tabellen-Ansicht */
  viewMode: ViewMode
  /** Dokumente gruppiert nach Jahr */
  docsByYear: Array<[number | string, DocCardMeta[]]>
  /** Callback für Dokument-Öffnen (optional: Fallback für Dokumente ohne slug) */
  onOpen?: (doc: DocCardMeta) => void
  /** Library ID (optional: Für URL-basierte Navigation) */
  libraryId?: string
}

/**
 * Wrapper-Komponente für ItemsGrid und ItemsTable
 * Wählt automatisch die richtige Komponente basierend auf viewMode
 */
export function ItemsView({ viewMode, docsByYear, onOpen, libraryId }: ItemsViewProps) {
  if (viewMode === 'table') {
    return <ItemsTable docsByYear={docsByYear} onOpen={onOpen} libraryId={libraryId} />
  }
  return <ItemsGrid docsByYear={docsByYear} onOpen={onOpen} libraryId={libraryId} />
}

