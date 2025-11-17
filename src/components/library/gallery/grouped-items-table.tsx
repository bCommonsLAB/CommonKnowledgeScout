'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ChatResponse } from '@/types/chat-response'
import type { QueryLog } from '@/types/query-log'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/hooks'
import { Button } from '@/components/ui/button'
import { useSetAtom } from 'jotai'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { openDocumentBySlug } from '@/utils/document-navigation'
import { ReferenceGroupHeader } from './reference-group-header'

interface GroupedItemsTableProps {
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
}

/**
 * Gruppierte Tabellenansicht für die Gallery
 * Zeigt Dokumente in zwei Gruppen: "In der Antwort gelandete Dokumente" und "Andere Dokumente"
 * Jede Gruppe hat einen aufklappbaren Header mit Referenzliste
 */
export function GroupedItemsTable({
  usedDocs,
  unusedDocs,
  references,
  sources,
  queryId,
  libraryId,
  onOpenDocument,
  onClose,
}: GroupedItemsTableProps) {
  const { t } = useTranslation()
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Handler für Dokument-Klick
  const handleRowClick = (doc: DocCardMeta) => {
    // Verwende zentrale Utility-Funktion wenn slug vorhanden ist
    if (doc.slug && libraryId) {
      openDocumentBySlug(doc.slug, libraryId, router, pathname, searchParams)
    } else if (onOpenDocument) {
      // Fallback: Verwende onClick-Callback
      onOpenDocument(doc)
    }
  }

  // Handler für Dokument-Klick (für ReferenceGroupHeader)
  const handleDocumentClick = (fileId: string) => {
    // Finde Dokument in usedDocs oder unusedDocs
    const doc = [...usedDocs, ...unusedDocs].find(
      d => d.fileId === fileId || d.id === fileId
    )
    if (doc) {
      handleRowClick(doc)
    }
  }

  // Handler für "zur Frage" Button
  const handleScrollToQuestion = () => {
    if (!queryId) return
    
    const tryScroll = (attempts = 0) => {
      const conversationElement = document.querySelector(`[data-conversation-id*="${queryId}"]`)
      
      if (conversationElement) {
        try {
          conversationElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          })
          
          const accordionTrigger = conversationElement.querySelector('[data-state="closed"]')
          if (accordionTrigger) {
            (accordionTrigger as HTMLElement).click()
          }
        } catch (error) {
          console.debug('[GroupedItemsTable] Scroll-Fehler ignoriert:', error)
        }
      } else if (attempts < 5) {
        setTimeout(() => tryScroll(attempts + 1), 200)
      }
    }
    
    tryScroll()
  }

  // Handler für "Referenzen schließen" Button
  const handleCloseReferences = () => {
    if (onClose) {
      onClose()
      return
    }
    
    setChatReferences({ references: [] })
    
    const event = new CustomEvent('clear-gallery-filter', {
      detail: {},
    })
    window.dispatchEvent(event)
  }

  // Formatiere Speaker für kompakte Anzeige
  const formatSpeakers = (doc: DocCardMeta): string => {
    if (Array.isArray(doc.speakers) && doc.speakers.length > 0) {
      return doc.speakers.length === 1
        ? doc.speakers[0]
        : `${doc.speakers[0]} +${doc.speakers.length - 1}`
    }
    // Fallback auf Autoren, wenn keine Speaker vorhanden
    if (Array.isArray(doc.authors) && doc.authors.length > 0) {
      return doc.authors.length === 1
        ? doc.authors[0]
        : `${doc.authors[0]} +${doc.authors.length - 1}`
    }
    return '-'
  }

  // Render-Tabelle für eine Dokumentenliste
  const renderTable = (docs: DocCardMeta[]) => {
    if (docs.length === 0) return null

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60%]">{t('gallery.table.title')}</TableHead>
              <TableHead className="w-[20%]">{t('gallery.table.year')}</TableHead>
              <TableHead className="w-[20%]">{t('gallery.table.track')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => (
              <TableRow
                key={doc.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleRowClick(doc)}
              >
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-1">
                    <span className="line-clamp-2">
                      {doc.shortTitle || doc.title || doc.fileName || 'Dokument'}
                    </span>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {formatSpeakers(doc)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {doc.year ? (
                    <Badge variant="secondary" className="text-xs">
                      {String(doc.year)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {doc.track ? (
                    <Badge variant="outline" className="text-xs">
                      {doc.track}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Überschrift "Quellenverzeichnis" mit Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 pb-2 px-0 py-2">
        <h2 className="text-lg font-semibold">{t('gallery.references')}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {queryId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleScrollToQuestion}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('gallery.scrollToQuestion')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCloseReferences}
            className="gap-2"
            aria-label={t('gallery.closeReferences')}
          >
            <X className="h-4 w-4" />
            {t('gallery.closeReferences')}
          </Button>
        </div>
      </div>

      {/* Gruppe 1: In der Antwort gelandete Dokumente */}
      {usedDocs.length > 0 && (
        <div>
          <ReferenceGroupHeader
            title={t('gallery.usedDocuments')}
            docCount={usedDocs.length}
            references={references}
            queryId={queryId}
            libraryId={libraryId}
            onDocumentClick={handleDocumentClick}
            value="used-references"
          />
          <div className="mt-4">{renderTable(usedDocs)}</div>
        </div>
      )}

      {/* Gruppe 2: Andere Dokumente */}
      {unusedDocs.length > 0 && (
        <div>
          <ReferenceGroupHeader
            title={t('gallery.otherDocuments')}
            docCount={unusedDocs.length}
            sources={sources}
            queryId={queryId}
            libraryId={libraryId}
            onDocumentClick={handleDocumentClick}
            value="unused-sources"
          />
          <div className="mt-4">{renderTable(unusedDocs)}</div>
        </div>
      )}

      {/* Fallback: Wenn keine Dokumente vorhanden */}
      {usedDocs.length === 0 && unusedDocs.length === 0 && (
        <div className="text-sm text-muted-foreground">
          Keine Dokumente gefunden.
        </div>
      )}
    </div>
  )
}

