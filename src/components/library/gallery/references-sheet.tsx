'use client'

import React, { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ChatResponse } from '@/types/chat-response'
import type { QueryLog } from '@/types/query-log'
import { GroupedItemsGrid } from './grouped-items-grid'
import { ItemsGrid } from './items-grid'
import { useGalleryData } from '@/hooks/gallery/use-gallery-data'
import { groupDocsByReferences } from '@/hooks/gallery/use-gallery-data'
import { useSessionHeaders } from '@/hooks/use-session-headers'
import { useTranslation } from '@/lib/i18n/hooks'
import { useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'

interface ReferencesSheetProps {
  /** Sheet geöffnet/geschlossen */
  open: boolean
  /** Callback für Öffnen/Schließen */
  onOpenChange: (open: boolean) => void
  /** Library ID */
  libraryId: string
  /** Modus: 'answer' für Antwort-Quellenverzeichnis (GroupedItemsGrid), 'toc' für TOC-Quellenverzeichnis (ItemsGrid) */
  mode: 'answer' | 'toc'
  /** Referenzen für Antwort-Modus */
  references?: ChatResponse['references']
  /** QueryId für Antwort-Modus */
  queryId?: string
  /** Callback für Dokument-Öffnen */
  onOpenDocument: (doc: DocCardMeta) => void
  /** Callback für Filter zurücksetzen */
  onClearFilters?: () => void
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
  references,
  queryId,
  onOpenDocument,
}: ReferencesSheetProps) {
  const { t } = useTranslation()
  const sessionHeaders = useSessionHeaders()
  const [sources, setSources] = useState<QueryLog['sources']>([])
  
  // Lade aktive Filter aus dem Atom (wie in gallery-root.tsx)
  const filters = useAtomValue(galleryFiltersAtom)


  // Für TOC-Modus: Lade gefilterte Dokumente (verwende aktive Filter aus URL/Atom)
  const { loading: tocLoading, error: tocError, filteredDocs, docsByYear } = useGalleryData(
    filters, // Verwende aktive Filter (wie in gallery-root.tsx)
    'story', // Mode für TOC
    '', // Keine Suche
    mode === 'toc' && libraryId ? libraryId : undefined // Nur laden wenn TOC-Modus
  )

  // Für Answer-Modus: Lade Sources aus QueryLog, falls queryId vorhanden
  useEffect(() => {
    if (mode !== 'answer' || !queryId || !libraryId) {
      setSources([])
      return
    }

    let cancelled = false

    async function loadSources() {
      // Type Guard: queryId ist bereits in useEffect geprüft, aber TypeScript braucht es hier nochmal
      if (!queryId) return
      
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`, {
          cache: 'no-store',
          headers: Object.keys(sessionHeaders).length > 0 ? sessionHeaders : undefined,
        })

        if (!res.ok || cancelled) {
          return
        }

        const queryLog = await res.json() as QueryLog

        if (cancelled) {
          return
        }

        setSources(queryLog.sources || [])
      } catch (error) {
        console.error('[ReferencesSheet] Fehler beim Laden der Sources:', error)
        setSources([])
      }
    }

    loadSources()

    return () => {
      cancelled = true
    }
  }, [mode, queryId, libraryId, sessionHeaders])

  const { loading: answerLoading, error: answerError, filteredDocs: answerFilteredDocs } = useGalleryData(
    filters, // Verwende aktive Filter (wie in gallery-root.tsx)
    'story',
    '', // Keine Suche
    mode === 'answer' && libraryId ? libraryId : undefined // Nur laden wenn Answer-Modus
  )

  // Gruppiere Dokumente nach Referenzen für Answer-Modus
  // WICHTIG: Verwende gefilterte Dokumente, nicht alle Dokumente
  const { usedDocs: answerUsedDocs, unusedDocs: answerUnusedDocs } = React.useMemo(() => {
    if (mode !== 'answer' || !references || references.length === 0) {
      return { usedDocs: [], unusedDocs: [] }
    }
    return groupDocsByReferences(answerFilteredDocs, references, sources)
  }, [mode, references, sources, answerFilteredDocs])


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
        <SheetTitle className="sr-only">{t('gallery.references')}</SheetTitle>
        
        {/* Header mit Titel und Schließen-Button nur im TOC-Modus (im Answer-Modus hat GroupedItemsGrid bereits einen Header) */}
        {mode === 'toc' && (
          <div className="flex items-center justify-between mb-2 pb-2 px-6 pt-6 border-b flex-shrink-0">
            <h2 className="text-lg font-semibold">{t('gallery.references')}</h2>
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
              {answerLoading ? (
                <div className="text-sm text-muted-foreground py-8">Lade Dokumente…</div>
              ) : answerError ? (
                <div className="text-sm text-destructive py-8">{answerError}</div>
              ) : references && references.length > 0 && (answerUsedDocs.length > 0 || answerUnusedDocs.length > 0) ? (
                <GroupedItemsGrid
                  usedDocs={answerUsedDocs}
                  unusedDocs={answerUnusedDocs}
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
              {tocLoading ? (
                <div className="text-sm text-muted-foreground py-8">Lade Dokumente…</div>
              ) : tocError ? (
                <div className="text-sm text-destructive py-8">{tocError}</div>
              ) : filteredDocs.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8">
                  Keine Dokumente gefunden.
                </div>
              ) : (
                <ItemsGrid docsByYear={docsByYear} onOpen={onOpenDocument} />
              )}
            </>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

