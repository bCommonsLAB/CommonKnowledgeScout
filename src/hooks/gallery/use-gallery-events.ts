'use client'

import { useEffect } from 'react'
import * as React from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ChatResponse } from '@/types/chat-response'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { openDocumentBySlug } from '@/utils/document-navigation'

export function useGalleryEvents(
  libraryId: string | undefined,
  docs: DocCardMeta[],
  onOpenDocument: (doc: DocCardMeta) => void,
  onShowReferenceLegend: () => void
) {
  const [, setFilters] = useAtom(galleryFiltersAtom)
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  // Ref, um zu verhindern, dass derselbe Event mehrfach verarbeitet wird
  const processingEventRef = React.useRef<string | null>(null)

  useEffect(() => {
    const handleOpenDocument = (event: Event) => {
      const customEvent = event as CustomEvent<{ fileId: string; fileName?: string; libraryId: string }>
      const { fileId, libraryId: eventLibraryId } = customEvent.detail || {}
      if (!fileId || !libraryId) return
      
      // Prüfe, ob libraryId übereinstimmt (verhindert Verarbeitung von Events aus anderen Libraries)
      if (eventLibraryId && eventLibraryId !== libraryId) {
        return
      }
      
      // Verhindere mehrfache Verarbeitung desselben Events
      const eventKey = `${fileId}-${libraryId}`
      if (processingEventRef.current === eventKey) {
        return
      }
      processingEventRef.current = eventKey
      
      const doc = docs.find(d => d.fileId === fileId || d.id === fileId)
      if (doc) {
        // Verwende zentrale Utility-Funktion wenn slug vorhanden
        if (doc.slug) {
          openDocumentBySlug(doc.slug, libraryId, router, pathname, searchParams)
        } else {
          // Fallback: Verwende onClick-Callback
        onOpenDocument(doc)
        }
      } else {
        // Dokument nicht gefunden → lade es neu und öffne dann
        // Verwende fileId als Fallback, da wir das Dokument noch nicht haben
        // Das wird später zu shortTitle gemappt, wenn das Dokument geladen ist
        setFilters(f => {
          const next = { ...(f as Record<string, string[] | undefined>) }
          // Temporär fileId verwenden, wird später zu shortTitle gemappt
          next.fileId = [fileId]
          return next as typeof f
        })
        setTimeout(() => {
          const docAfterLoad = docs.find(d => d.fileId === fileId || d.id === fileId)
          if (docAfterLoad) {
            // Mappe zu shortTitle, wenn Dokument gefunden
            setFilters(f => {
              const current = f as Record<string, string[] | undefined>
              const next = { ...current }
              delete next.fileId
              const shortTitle = docAfterLoad.shortTitle || docAfterLoad.title
              if (shortTitle) {
                next.shortTitle = [shortTitle]
              }
              return next as typeof f
            })
            // Verwende zentrale Utility-Funktion wenn slug vorhanden
            if (docAfterLoad.slug) {
              openDocumentBySlug(docAfterLoad.slug, libraryId, router, pathname, searchParams)
            } else {
              // Fallback: Verwende onClick-Callback
            onOpenDocument(docAfterLoad)
            }
          }
        }, 500)
      }
      
      // Reset processing flag nach kurzer Verzögerung
      setTimeout(() => {
        processingEventRef.current = null
      }, 300)
    }
    window.addEventListener('open-document-detail', handleOpenDocument)
    return () => {
      window.removeEventListener('open-document-detail', handleOpenDocument)
      processingEventRef.current = null
    }
  }, [docs, libraryId, setFilters, onOpenDocument, router, pathname, searchParams])

  useEffect(() => {
    const handleShowLegend = (event: Event) => {
      const customEvent = event as CustomEvent<{ references: ChatResponse['references']; libraryId: string; queryId?: string }>
      const { references: refs, queryId } = customEvent.detail || {}
      if (!refs || refs.length === 0) return
      
      // Setze nur chatReferences, NICHT die fileId-Filter
      // GroupedItemsGrid filtert die Dokumente selbst basierend auf references/sources
      // Die fileId-Filter würden die Dokumentenanzahl in FilterContextBar beeinflussen,
      // obwohl wir sie dort nicht mehr anzeigen wollen
      setChatReferences({ references: refs, queryId })
      onShowReferenceLegend()
      
      // Scroll zur Gallery-Sektion (falls vorhanden)
      const el = document.querySelector('[data-gallery-section]')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('show-reference-legend', handleShowLegend)
    return () => window.removeEventListener('show-reference-legend', handleShowLegend)
  }, [setChatReferences, onShowReferenceLegend])
}

