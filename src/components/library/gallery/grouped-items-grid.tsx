'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ChatResponse } from '@/types/chat-response'
import type { QueryLog } from '@/types/query-log'
import { DocumentCard } from './document-card'
import { ReferenceGroupHeader } from './reference-group-header'
import { useTranslation } from '@/lib/i18n/hooks'
import { Button } from '@/components/ui/button'
import { ArrowLeft, X } from 'lucide-react'
import { useSetAtom } from 'jotai'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { openDocumentBySlug } from '@/utils/document-navigation'

interface GroupedItemsGridProps {
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
 * Gruppierte Items-Grid-Komponente für die Gallery
 * Zeigt Dokumente in zwei Gruppen: "In der Antwort gelandete Dokumente" und "Andere Dokumente"
 * Jede Gruppe hat einen aufklappbaren Header mit Referenzliste
 */
export function GroupedItemsGrid({
  usedDocs,
  unusedDocs,
  references,
  sources,
  queryId,
  libraryId,
  onOpenDocument,
  onClose,
}: GroupedItemsGridProps) {
  const { t } = useTranslation()
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Handler für Dokument-Klick (für ReferenceGroupHeader)
  const handleDocumentClick = (fileId: string, fileName?: string) => {
    // Finde Dokument in usedDocs oder unusedDocs
    const doc = [...usedDocs, ...unusedDocs].find(
      d => d.fileId === fileId || d.id === fileId
    )
    if (doc) {
      // Verwende zentrale Utility-Funktion wenn slug vorhanden
      if (doc.slug) {
        openDocumentBySlug(doc.slug, libraryId, router, pathname, searchParams)
      } else if (onOpenDocument) {
        // Fallback: Verwende onClick-Callback
      onOpenDocument(doc)
      } else {
        // Fallback: Öffne Detailansicht über Event
        const event = new CustomEvent('open-document-detail', {
          detail: { fileId, fileName, libraryId },
        })
        window.dispatchEvent(event)
      }
    } else {
      // Fallback: Öffne Detailansicht über Event
      const event = new CustomEvent('open-document-detail', {
        detail: { fileId, fileName, libraryId },
      })
      window.dispatchEvent(event)
    }
  }

  // Handler für "zur Frage" Button - scrollt zur entsprechenden Frage im Chat
  const handleScrollToQuestion = () => {
    if (!queryId) return
    
    // Versuche, das Conversation-Element mit dieser queryId zu finden
    const tryScroll = (attempts = 0) => {
      // Suche nach dem Conversation-Element mit dieser queryId
      // Die queryId wird als conversationId verwendet: `${queryId}-${msg.id}`
      // Oder einfach als queryId, wenn es direkt verwendet wird
      const conversationElement = document.querySelector(`[data-conversation-id*="${queryId}"]`)
      
      if (conversationElement) {
        try {
          // Scroll zum Conversation-Element
          conversationElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          })
          
          // Öffne das Accordion, falls es geschlossen ist
          const accordionTrigger = conversationElement.querySelector('[data-state="closed"]')
          if (accordionTrigger) {
            (accordionTrigger as HTMLElement).click()
          }
        } catch (error) {
          console.debug('[GroupedItemsGrid] Scroll-Fehler ignoriert:', error)
        }
      } else if (attempts < 5) {
        // Versuche es nochmal nach kurzer Verzögerung
        setTimeout(() => tryScroll(attempts + 1), 200)
      }
    }
    
    tryScroll()
  }

  // Handler für "Referenzen schließen" Button
  const handleCloseReferences = () => {
    // Wenn onClose-Callback vorhanden ist (z.B. im ReferencesSheet), rufe diesen auf
    if (onClose) {
      onClose()
      return
    }
    
    // Standard-Verhalten: Setze Referenzen zurück und zeige normale Galerie
    setChatReferences({ references: [] })
    
    // Setze Filter zurück (entferne fileId-Filter)
    const event = new CustomEvent('clear-gallery-filter', {
      detail: {},
    })
    window.dispatchEvent(event)
  }

  return (
    <div className="space-y-8">
      {/* Überschrift "Quellenverzeichnis" mit Buttons "zur Frage" und "Schließen" */}
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
          {/* Close-Button: Im Answer-Modus (wenn onClose vorhanden) schließt er das Sheet, sonst setzt er Referenzen zurück */}
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
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {usedDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onClick={onOpenDocument} libraryId={libraryId} />
            ))}
          </div>
        </div>
      )}

      {/* Gruppe 2: Andere Dokumente, die sich auch mit dieser Frage beschäftigen */}
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
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {unusedDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onClick={onOpenDocument} libraryId={libraryId} />
            ))}
          </div>
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

