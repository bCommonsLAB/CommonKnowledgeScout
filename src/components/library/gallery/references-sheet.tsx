'use client'

import React from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ChatResponse } from '@/types/chat-response'
import type { QueryLog } from '@/types/query-log'
import { GroupedItemsView } from './grouped-items-view'
import { ItemsView } from './items-view'
import { ViewModeToggle } from './view-mode-toggle'
import { useTranslation } from '@/lib/i18n/hooks'
import type { ViewMode } from './gallery-sticky-header'

interface ReferencesSheetProps {
  /** Sheet geöffnet/geschlossen */
  open: boolean
  /** Callback für Öffnen/Schließen */
  onOpenChange: (open: boolean) => void
  /** Library ID */
  libraryId: string
  /** Modus: 'answer' für Antwort-Quellenverzeichnis (GroupedItemsView), 'toc' für TOC-Quellenverzeichnis (ItemsView) */
  mode: 'answer' | 'toc'
  /** View-Mode: 'grid' für Galerie-Ansicht, 'table' für Tabellen-Ansicht */
  viewMode?: ViewMode
  /** Callback für View-Mode-Änderung */
  onViewModeChange?: (mode: ViewMode) => void
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
  onViewModeChange,
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
  const [localViewMode, setLocalViewMode] = React.useState<ViewMode>(viewMode)

  // Synchronisiere lokalen View-Mode mit Prop
  React.useEffect(() => {
    if (viewMode !== undefined) {
      setLocalViewMode(viewMode)
    }
  }, [viewMode])

  // Handler für View-Mode-Änderung
  const handleViewModeChange = (mode: ViewMode) => {
    setLocalViewMode(mode)
    if (onViewModeChange) {
      onViewModeChange(mode)
    }
  }

  // Aktueller View-Mode (verwende Prop falls vorhanden, sonst lokalen State)
  const currentViewMode = viewMode !== undefined ? viewMode : localViewMode

  // Handler für Schließen im Answer-Modus (wird an GroupedItemsView übergeben)
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
        
        {/* Header mit Titel, View-Mode-Toggle und Schließen-Button nur im TOC-Modus (im Answer-Modus hat GroupedItemsView bereits einen Header) */}
        {mode === 'toc' && (
          <div className="flex flex-col gap-2 mb-2 pb-2 px-6 pt-6 border-b flex-shrink-0">
            {/* Titel und Close-Button in einer Zeile */}
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{t('gallery.tocReferences')}</h2>
              <div className="flex items-center gap-2">
                {/* View-Mode-Toggle - nur auf Desktop neben dem Close-Button */}
                {onViewModeChange && (
                  <div className="hidden lg:flex items-center">
                    <ViewModeToggle viewMode={currentViewMode} onViewModeChange={handleViewModeChange} compact />
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloseTOC}
                  className="gap-2"
                  aria-label={t('gallery.closeReferences')}
                >
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('gallery.closeReferences')}</span>
                </Button>
              </div>
            </div>
            {/* View-Mode-Toggle - unterhalb des Close-Buttons auf Mobile */}
            {onViewModeChange && (
              <div className="flex items-center justify-end lg:hidden">
                <ViewModeToggle viewMode={currentViewMode} onViewModeChange={handleViewModeChange} compact />
              </div>
            )}
          </div>
        )}

        <ScrollArea className={`flex-1 px-6`}>
          {mode === 'answer' ? (
            <>
              {loading ? (
                <div className="text-sm text-muted-foreground py-8">Lade Dokumente…</div>
              ) : error ? (
                <div className="text-sm text-destructive py-8">{error}</div>
              ) : references && references.length > 0 && (usedDocs.length > 0 || unusedDocs.length > 0) ? (
                <GroupedItemsView
                  viewMode={currentViewMode}
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
              ) : (
                <ItemsView viewMode={currentViewMode} docsByYear={docsByYear} onOpen={onOpenDocument} libraryId={libraryId} />
              )}
            </>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

