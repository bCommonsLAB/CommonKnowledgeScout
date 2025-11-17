'use client'

import React from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ChatResponse } from '@/types/chat-response'
import type { QueryLog } from '@/types/query-log'
import { GroupedItemsGrid } from './grouped-items-grid'
import { ItemsGrid } from './items-grid'
import { GroupedItemsTable } from './grouped-items-table'
import { ItemsTable } from './items-table'
import { useTranslation } from '@/lib/i18n/hooks'
import type { ViewMode } from './gallery-sticky-header'

interface ReferencesSheetProps {
  /** Sheet geöffnet/geschlossen */
  open: boolean
  /** Callback für Öffnen/Schließen */
  onOpenChange: (open: boolean) => void
  /** Library ID */
  libraryId: string
  /** Modus: 'answer' für Antwort-Quellenverzeichnis (GroupedItemsGrid), 'toc' für TOC-Quellenverzeichnis (ItemsGrid) */
  mode: 'answer' | 'toc'
  /** View-Mode: 'grid' für Galerie-Ansicht, 'table' für Tabellen-Ansicht */
  viewMode?: ViewMode
  /** Referenzen für Antwort-Modus */
  references?: ChatResponse['references']
  /** QueryId für Antwort-Modus */
  queryId?: string
  /** Callback für Dokument-Öffnen (optional: Fallback für Dokumente ohne slug) */
  onOpenDocument?: (doc: DocCardMeta) => void
  /** Callback für Filter zurücksetzen */
  onClearFilters?: () => void
  /** Props für TOC-Modus: Gefilterte Dokumente und Jahrgangs-Gruppierung */
  filteredDocs?: DocCardMeta[]
  docsByYear?: Array<[number | string, DocCardMeta[]]>
  /** Props für Answer-Modus: Gruppierte Dokumente */
  usedDocs?: DocCardMeta[]
  unusedDocs?: DocCardMeta[]
  /** Sources für Answer-Modus */
  sources?: QueryLog['sources']
  /** Loading-State */
  loading?: boolean
  /** Error-State */
  error?: string | null
}

/**
 * Fullscreen-Sheet für Mobile, das das Quellenverzeichnis anzeigt
 * 
 * - Modus 'answer': Zeigt GroupedItemsGrid mit verwendeten und nicht verwendeten Dokumenten
 * - Modus 'toc': Zeigt ItemsGrid mit allen Dokumenten (normale Jahres-Gruppierung)
 */
export function ReferencesSheet({
  open,
  onOpenChange,
  libraryId,
  mode,
  viewMode = 'grid',
  references,
  queryId,
  onOpenDocument,
  filteredDocs = [],
  docsByYear = [],
  usedDocs = [],
  unusedDocs = [],
  sources = [],
  loading = false,
  error = null,
}: ReferencesSheetProps) {
  const { t } = useTranslation()

  // Handler für Schließen im Answer-Modus (wird an GroupedItemsGrid übergeben)
  const handleCloseAnswer = () => {
    onOpenChange(false)
  }

  // Handler für Schließen im TOC-Modus
  const handleCloseTOC = () => {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0"
        hideCloseButton={true}
      >
        {/* SheetTitle für Barrierefreiheit */}
        <SheetTitle className="sr-only">{mode === 'toc' ? t('gallery.tocReferences') : t('gallery.references')}</SheetTitle>
        
        {/* Header mit Titel und Schließen-Button nur im TOC-Modus (im Answer-Modus hat GroupedItemsGrid bereits einen Header) */}
        {mode === 'toc' && (
          <div className="flex items-center justify-between mb-2 pb-2 px-6 pt-6 border-b flex-shrink-0">
            <h2 className="text-lg font-semibold">{t('gallery.tocReferences')}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseTOC}
              className="gap-2"
              aria-label={t('gallery.closeReferences')}
            >
              <X className="h-4 w-4" />
              {t('gallery.closeReferences')}
            </Button>
          </div>
        )}

        <ScrollArea className={`flex-1 px-6 ${mode === 'toc' ? 'py-4' : 'pt-6 pb-4'}`}>
          {mode === 'answer' ? (
            <>
              {loading ? (
                <div className="text-sm text-muted-foreground py-8">Lade Dokumente…</div>
              ) : error ? (
                <div className="text-sm text-destructive py-8">{error}</div>
              ) : references && references.length > 0 && (usedDocs.length > 0 || unusedDocs.length > 0) ? (
                viewMode === 'table' ? (
                  <GroupedItemsTable
                    usedDocs={usedDocs}
                    unusedDocs={unusedDocs}
                    references={references}
                    sources={sources}
                    queryId={queryId}
                    libraryId={libraryId}
                    onOpenDocument={onOpenDocument}
                    onClose={handleCloseAnswer}
                  />
                ) : (
                  <GroupedItemsGrid
                    usedDocs={usedDocs}
                    unusedDocs={unusedDocs}
                    references={references}
                    sources={sources}
                    queryId={queryId}
                    libraryId={libraryId}
                    onOpenDocument={onOpenDocument}
                    onClose={handleCloseAnswer}
                  />
                )
              ) : (
                <div className="text-sm text-muted-foreground py-8">
                  Keine Referenzen verfügbar.
                </div>
              )}
            </>
          ) : (
            <>
              {loading ? (
                <div className="text-sm text-muted-foreground py-8">Lade Dokumente…</div>
              ) : error ? (
                <div className="text-sm text-destructive py-8">{error}</div>
              ) : filteredDocs.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8">
                  Keine Dokumente gefunden.
                </div>
              ) : viewMode === 'table' ? (
                <ItemsTable docsByYear={docsByYear} onOpen={onOpenDocument} libraryId={libraryId} />
              ) : (
                <ItemsGrid docsByYear={docsByYear} onOpen={onOpenDocument} libraryId={libraryId} />
              )}
            </>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

