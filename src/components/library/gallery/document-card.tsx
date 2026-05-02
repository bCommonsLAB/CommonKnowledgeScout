'use client'

/**
 * src/components/library/gallery/document-card.tsx
 *
 * Composer-Fassade fuer DocumentCard.
 *
 * Wellen-3-III-a Modul-Split: Die DocumentCard ist nur noch ein
 * **Switch-Composer**, der je nach detailViewType die passende
 * Sub-Karte rendert. Die Card-Layouts liegen in
 * `./document-card/<type>-card.tsx`.
 *
 * Vor Welle 3-III-a: 638 Zeilen, 5 inline-Funktionen.
 * Nach Welle 3-III-a: ~60 Zeilen Composer + 5 Sub-Komponenten in
 * eigenen Files.
 *
 * Verhalten 1:1 portiert — Char-Tests in
 * tests/unit/components/library/gallery/document-card.test.tsx
 * fixieren das Switch-Verhalten.
 */

import React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { DocCardMeta } from '@/lib/gallery/types'
import { openDocumentBySlug } from '@/utils/document-navigation'
import { getEffectiveDocumentNavigationSlug } from '@/utils/document-slug'
import { DivaTextureCard } from './document-card/diva-texture-card'
import { ClimateActionCard } from './document-card/climate-action-card'
import { SessionCard } from './document-card/session-card'
import { RefurbedDeviceCard } from './document-card/refurbed-device-card'
import { StandardCard } from './document-card/standard-card'

export interface DocumentCardProps {
  doc: DocCardMeta
  /** Optional: Fallback fuer Komponenten ohne slug */
  onClick?: (doc: DocCardMeta) => void
  /** Optional: Falls nicht vorhanden, wird onClick verwendet */
  libraryId?: string
  /** Fallback-DetailViewType aus der Library-Config (wenn doc.detailViewType nicht gesetzt ist) */
  libraryDetailViewType?: string
}

export function DocumentCard({ doc, onClick, libraryId, libraryDetailViewType }: DocumentCardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleClick = () => {
    const slug = getEffectiveDocumentNavigationSlug(doc)
    if (slug && libraryId) {
      openDocumentBySlug(slug, libraryId, router, pathname, searchParams)
    } else if (onClick) {
      onClick(doc)
    } else {
      console.warn('[DocumentCard] Kein navigierbarer Slug/fileId oder onClick-Callback:', doc)
    }
  }

  // Bestimme den effektiven DetailViewType: Dokument-spezifisch oder Library-Fallback
  const effectiveDetailViewType = doc.detailViewType || libraryDetailViewType

  // Quadratische Textur-Kachel (Hintergrund = wiederholte Cover-Textur)
  if (effectiveDetailViewType === 'divaTexture') {
    return <DivaTextureCard doc={doc} onClick={handleClick} libraryId={libraryId} />
  }

  // Spezielles Layout fuer ClimateAction
  if (effectiveDetailViewType === 'climateAction') {
    return <ClimateActionCard doc={doc} onClick={handleClick} />
  }

  // YouTube-artiges Layout fuer Sessions/Events
  if (effectiveDetailViewType === 'session') {
    return <SessionCard doc={doc} onClick={handleClick} />
  }

  // Vollflaechige Karte fuer gebrauchte PCs/Notebooks (refurbedDevice)
  if (effectiveDetailViewType === 'refurbedDevice') {
    return <RefurbedDeviceCard doc={doc} onClick={handleClick} />
  }

  // Standard-Layout fuer alle anderen Typen (Buecher, Dokumente, etc.)
  return <StandardCard doc={doc} onClick={handleClick} />
}
