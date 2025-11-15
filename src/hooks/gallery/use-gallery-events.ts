'use client'

import { useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ChatResponse } from '@/types/chat-response'

export function useGalleryEvents(
  libraryId: string | undefined,
  docs: DocCardMeta[],
  onOpenDocument: (doc: DocCardMeta) => void,
  onShowReferenceLegend: () => void
) {
  const [, setFilters] = useAtom(galleryFiltersAtom)
  const setChatReferences = useSetAtom(chatReferencesAtom)

  useEffect(() => {
    const handleOpenDocument = (event: Event) => {
      const customEvent = event as CustomEvent<{ fileId: string; fileName?: string; libraryId: string }>
      const { fileId } = customEvent.detail || {}
      if (!fileId || !libraryId) return
      const doc = docs.find(d => d.fileId === fileId || d.id === fileId)
      if (doc) {
        onOpenDocument(doc)
      } else {
        // Dokument nicht gefunden → lade es neu und öffne dann
        setFilters(f => {
          const next = { ...(f as Record<string, string[] | undefined>) }
          next.fileId = [fileId]
          return next as typeof f
        })
        setTimeout(() => {
          const docAfterLoad = docs.find(d => d.fileId === fileId || d.id === fileId)
          if (docAfterLoad) {
            onOpenDocument(docAfterLoad)
          }
        }, 500)
      }
    }
    window.addEventListener('open-document-detail', handleOpenDocument)
    return () => window.removeEventListener('open-document-detail', handleOpenDocument)
  }, [docs, libraryId, setFilters, onOpenDocument])

  useEffect(() => {
    const handleShowLegend = (event: Event) => {
      const customEvent = event as CustomEvent<{ references: ChatResponse['references']; libraryId: string; queryId?: string }>
      const { references: refs, queryId } = customEvent.detail || {}
      if (!refs || refs.length === 0) return
      setChatReferences({ references: refs, queryId })
      onShowReferenceLegend()
      const fileIds = Array.from(new Set(refs.map(r => r.fileId)))
      setFilters(f => {
        const next = { ...(f as Record<string, string[] | undefined>) }
        next.fileId = fileIds
        return next as typeof f
      })
      const el = document.querySelector('[data-gallery-section]')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('show-reference-legend', handleShowLegend)
    return () => window.removeEventListener('show-reference-legend', handleShowLegend)
  }, [setFilters, setChatReferences, onShowReferenceLegend])
}

