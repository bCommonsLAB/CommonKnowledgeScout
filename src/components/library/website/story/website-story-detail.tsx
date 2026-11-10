'use client'

/**
 * Detailansicht eines zitierten Eintrags UEBER der Startseite (Owner
 * 10.11.2026): der Klick auf eine Karte oder einen Beleg oeffnet dieselbe
 * `DetailOverlay` wie die Galerie — die Startseite bleibt im Hintergrund,
 * Frage und Antwort gehen nicht verloren. Kein Adress-Parameter: Schliessen
 * fuehrt zurueck an dieselbe Stelle der Seite.
 *
 * Faul geladen (`website-story-sektion.tsx`): die Tabelle der Detail-Renderer
 * zieht zehn Ansichten nach, die nur braucht, wer einen Eintrag oeffnet.
 * Ohne „In Story Mode ansehen" — der Wechsel dorthin verliesse die Startseite.
 */

import { getDetailViewType, type DocCardMeta } from '@ks/contracts'
import { DetailOverlay, resolveDetailViewTypeForDoc } from '@ks/module-explorer/react'
import { useLibraries } from '@ks/shell/react'
import { DETAIL_RENDERERS } from '@/components/library/gallery-detail-renderers'

export interface WebsiteStoryDetailProps {
  libraryId: string
  doc: DocCardMeta
  /** Seite, an der die Ansicht aufgeht (Beleg mit Textstelle); ohne Angabe am Anfang. */
  page?: number
  onClose: () => void
}

export function WebsiteStoryDetail({ libraryId, doc, page, onClose }: WebsiteStoryDetailProps) {
  const libraries = useLibraries()
  const library = libraries.find((l) => l.id === libraryId)
  // Typ je Dokument, sonst der Library — dieselbe Aufloesung wie in der Galerie (meldet Unbekanntes).
  const viewType = resolveDetailViewTypeForDoc(doc.detailViewType, getDetailViewType({}, library?.config?.chat))
  return (
    <DetailOverlay
      open
      onClose={onClose}
      libraryId={libraryId}
      fileId={doc.fileId || doc.id}
      page={page}
      viewType={viewType}
      detailRenderers={DETAIL_RENDERERS}
      doc={doc}
      storyModusVerfuegbar={false}
      fallbackLocale={library?.config?.translations?.fallbackLocale}
    />
  )
}
