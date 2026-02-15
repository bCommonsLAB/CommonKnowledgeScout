"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { BookDetail } from "@/components/library/book-detail"
import { SessionDetail } from "@/components/library/session-detail"
import { TestimonialDetail } from "@/components/library/testimonial-detail"
import { ClimateActionDetail } from "@/components/library/climate-action-detail"
import { DivaDocumentDetail } from "@/components/library/diva-document-detail"
import type { StorageProvider } from "@/lib/storage/types"
import type { TemplatePreviewDetailViewType } from "@/lib/templates/template-types"
import { mapToBookDetail, mapToSessionDetail, mapToTestimonialDetail, mapToClimateActionDetail, mapToDivaDocumentDetail } from "@/lib/mappers/doc-meta-mappers"
import { validateMetadataForViewType, formatValidationWarning } from "@/lib/detail-view-types"

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
  /** Optional: Blendet Event-Tools (QR/Testimonial-Liste/Co-Creation) aus */
  hideEventTools?: boolean
  /** Optional: Blendet Debug-Informationen aus */
  hideDebug?: boolean
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
  hideEventTools = false,
  hideDebug = false,
}: DetailViewRendererProps) {
  // Mapper erwarten API-ähnliche Struktur: { docMetaJson: { ... } }
  const docMetaJson = React.useMemo(() => {
    const base = { ...(metadata || {}) }
    if (markdown && typeof markdown === "string") {
      ;(base as Record<string, unknown>).markdown = markdown
    }
    return { docMetaJson: base }
  }, [metadata, markdown])
  
  // Validiere Pflichtfelder für den gewählten ViewType
  const validation = React.useMemo(
    () => validateMetadataForViewType(metadata || {}, detailViewType),
    [metadata, detailViewType]
  )
  
  // Warnung für fehlende Pflichtfelder
  const MissingFieldsWarning = React.useMemo(() => {
    if (validation.isValid) return null
    
    const warning = formatValidationWarning(validation)
    if (!warning) return null
    
    return (
      <div className="flex items-start gap-2 p-3 mx-4 mt-4 rounded-md border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-medium text-yellow-800 dark:text-yellow-300">
            {warning}
          </p>
          <p className="text-yellow-700 dark:text-yellow-400 mt-1">
            Diese Felder sollten im Template definiert sein, damit die Detail-Ansicht vollständig funktioniert.
          </p>
        </div>
      </div>
    )
  }, [validation])

  // Rendere die passende Detail-Komponente basierend auf detailViewType
  if (detailViewType === "book") {
    return (
      <>
        {MissingFieldsWarning}
        <BookDetail data={mapToBookDetail(docMetaJson)} showBackLink={showBackLink} />
      </>
    )
  }
  
  if (detailViewType === "testimonial") {
    return (
      <>
        {MissingFieldsWarning}
        <TestimonialDetail data={mapToTestimonialDetail(docMetaJson)} showBackLink={showBackLink} libraryId={libraryId} />
      </>
    )
  }
  
  if (detailViewType === "climateAction") {
    return (
      <>
        {MissingFieldsWarning}
        <ClimateActionDetail data={mapToClimateActionDetail(docMetaJson)} showBackLink={showBackLink} />
      </>
    )
  }
  
  if (detailViewType === "divaDocument") {
    return (
      <>
        {MissingFieldsWarning}
        <DivaDocumentDetail data={mapToDivaDocumentDetail(docMetaJson)} showBackLink={showBackLink} />
      </>
    )
  }
  
  // Default: Session
  return (
    <>
      {MissingFieldsWarning}
      <SessionDetail
        data={mapToSessionDetail(docMetaJson)}
        showBackLink={showBackLink}
        libraryId={libraryId}
        provider={provider}
        currentFolderId={currentFolderId}
        hideEventTools={hideEventTools}
        hideDebug={hideDebug}
      />
    </>
  )
}

