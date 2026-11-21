'use client'

/**
 * Detailansicht eines Dokuments auf der eingebetteten Startseite (WE4,
 * Entscheid A): Banner-Karte und Beleg oeffnen sie ueber dem Fenster der
 * Container-Seite — nicht nur ueber dem Rahmen, der bei natuerlicher Hoehe
 * hoeher ist als das Fenster. Darum rendert sie in den Portal-Ort am `body`.
 *
 * Nur Typen mit eingebetteter Ansicht (`EMBED_DETAIL_TYPEN`) oeffnen hier; die
 * uebrigen fuehren ueber die Navigation auf die Galerie-Seite der
 * Container-Anwendung (Ziel `dokument`) — dort zeigt die Galerie-Komponente sie.
 * Mit `zuerstContainer` (Option `documentsViaHrefFor`) wird die
 * Container-Anwendung fuer jeden Typ zuerst gefragt (`embed-site-dokument.ts`).
 */

import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getDetailViewType, type DocCardMeta } from '@ks/contracts'
import {
  DetailOverlay,
  EMBED_DETAIL_RENDERERS,
  EMBED_DETAIL_TYPEN,
  resolveDetailViewTypeForDoc,
  type ExplorerLibraryPayload,
} from '@ks/module-explorer/react'
import type { WebsiteNavigation } from '@ks/module-website'
import { getEffectiveDocumentNavigationSlug } from '@ks/util'
import { dokumentWeg } from './embed-site-dokument'

export interface EmbedSiteDetailProps {
  library: ExplorerLibraryPayload
  doc: DocCardMeta
  page?: number
  onClose: () => void
  navigation: WebsiteNavigation
  /** Die Container-Anwendung zuerst fragen, auch bei Typen mit eingebetteter Ansicht. */
  zuerstContainer: boolean
  /** Portal-Ort am `body` der Container-Seite (Klasse `.ks-embed`). */
  portal: HTMLElement
}

export function EmbedSiteDetail({ library, doc, page, onClose, navigation, zuerstContainer, portal }: EmbedSiteDetailProps) {
  const viewType = resolveDetailViewTypeForDoc(
    doc.detailViewType,
    getDetailViewType({ detailViewType: library.chat?.gallery?.detailViewType }),
  )
  const eingebettet = EMBED_DETAIL_TYPEN.has(viewType)
  const weg = useMemo(
    () => dokumentWeg({ slug: getEffectiveDocumentNavigationSlug(doc) || null, page, eingebettet, zuerstContainer, navigation }),
    [doc, page, eingebettet, zuerstContainer, navigation],
  )

  useEffect(() => {
    if (weg.art === 'eingebettet') return
    if (weg.art === 'container') weg.ausfuehren()
    else console.error(`[KnowledgeScoutSite] ${weg.grund}`, doc)
    onClose()
  }, [weg, doc, onClose])

  if (weg.art !== 'eingebettet') return null
  return createPortal(
    <DetailOverlay
      open
      onClose={onClose}
      libraryId={library.id}
      fileId={doc.fileId || doc.id}
      page={page}
      viewType={viewType}
      detailRenderers={EMBED_DETAIL_RENDERERS}
      doc={doc}
      storyModusVerfuegbar={false}
    />,
    portal,
  )
}
