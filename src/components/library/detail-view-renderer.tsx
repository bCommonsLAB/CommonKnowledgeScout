"use client"

import * as React from "react"
import { BookDetail } from "@/components/library/book-detail"
import { SessionDetail } from "@/components/library/session-detail"
import { TestimonialDetail } from "@/components/library/testimonial-detail"
import type { StorageProvider } from "@/lib/storage/types"
import type { TemplatePreviewDetailViewType } from "@/lib/templates/template-types"
import { mapToBookDetail, mapToSessionDetail, mapToTestimonialDetail } from "@/lib/mappers/doc-meta-mappers"

interface DetailViewRendererProps {
  /** Typ der Detailansicht */
  detailViewType: TemplatePreviewDetailViewType
  /** Metadaten aus Frontmatter */
  metadata: Record<string, unknown>
  /** Optional: Markdown-Body */
  markdown?: string
  /** Optional: Library-ID für Links */
  libraryId?: string
  /** Optional: Back-Link anzeigen (Standard: false) */
  showBackLink?: boolean
  /** Optional: Provider für Bild-Auflösung im MarkdownPreview (z.B. Shadow-Twin Bilder) */
  provider?: StorageProvider | null
  /** Optional: Folder-ID (base64) für relative Bilder im MarkdownPreview */
  currentFolderId?: string
}

/**
 * Gemeinsamer Renderer für Detailansichten (Book/Session/Testimonial).
 * 
 * Wird sowohl im Creation-Wizard (PreviewDetailStep) als auch in der
 * File-Preview verwendet, um Duplikation zu vermeiden.
 */
export function DetailViewRenderer({
  detailViewType,
  metadata,
  markdown,
  libraryId,
  showBackLink = false,
  provider = null,
  currentFolderId = 'root',
}: DetailViewRendererProps) {
  // Mapper erwarten API-ähnliche Struktur: { docMetaJson: { ... } }
  const docMetaJson = React.useMemo(() => {
    const base = { ...(metadata || {}) }
    if (markdown && typeof markdown === "string") {
      ;(base as Record<string, unknown>).markdown = markdown
    }
    return { docMetaJson: base }
  }, [metadata, markdown])

  // Rendere die passende Detail-Komponente basierend auf detailViewType
  if (detailViewType === "book") {
    return <BookDetail data={mapToBookDetail(docMetaJson)} showBackLink={showBackLink} />
  }
  
  if (detailViewType === "testimonial") {
    return <TestimonialDetail data={mapToTestimonialDetail(docMetaJson)} showBackLink={showBackLink} libraryId={libraryId} />
  }
  
  // Default: Session
  return (
    <SessionDetail
      data={mapToSessionDetail(docMetaJson)}
      showBackLink={showBackLink}
      libraryId={libraryId}
      provider={provider}
      currentFolderId={currentFolderId}
    />
  )
}

