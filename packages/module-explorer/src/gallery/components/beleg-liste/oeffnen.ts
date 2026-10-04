'use client'

/**
 * Ein Dokument aus der Quellen-Spalte oeffnen (D3, D12q): ueber die
 * Adressierung der Galerie (Slug, optional mit Seite), sonst ueber den
 * Rueckfall des Gastgebers, sonst ueber das Ereignis der Detailansicht.
 * Belegliste (Antwort) und Quellenliste (Uebersicht) nehmen denselben Weg.
 */

import { useCallback } from 'react'
import type { DocCardMeta } from '@ks/contracts'
import { getEffectiveDocumentNavigationSlug } from '@ks/util'
import { useGalleryNavigation } from '../../contexts/gallery-navigation-context'

export interface DokumentOeffnen {
  (doc: DocCardMeta | undefined, fileId: string, fileName?: string, page?: number): void
}

export function useDokumentOeffnen(libraryId: string, onOpenDocument?: (doc: DocCardMeta) => void): DokumentOeffnen {
  const { openDocument } = useGalleryNavigation()
  return useCallback(
    (doc, fileId, fileName, page) => {
      const slug = doc ? getEffectiveDocumentNavigationSlug(doc) : undefined
      // D7: Nur die Adressierung kennt die Seite; die Rueckfaelle oeffnen am Anfang.
      if (slug && page !== undefined) openDocument(slug, { page })
      else if (slug) openDocument(slug)
      else if (doc && onOpenDocument) onOpenDocument(doc)
      else window.dispatchEvent(new CustomEvent('open-document-detail', { detail: { fileId, fileName, libraryId } }))
    },
    [openDocument, onOpenDocument, libraryId],
  )
}
