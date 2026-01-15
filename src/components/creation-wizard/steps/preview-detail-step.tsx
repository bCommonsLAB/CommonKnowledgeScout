"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import type { TemplatePreviewDetailViewType } from "@/lib/templates/template-types"
import { DetailViewRenderer } from "@/components/library/detail-view-renderer"
import type { StorageProvider } from "@/lib/storage/types"

interface PreviewDetailStepProps {
  detailViewType: TemplatePreviewDetailViewType
  metadata: Record<string, unknown>
  markdown?: string
  /** Optional: zeigt Library-spezifische Links in SessionDetail (Open in Library) */
  libraryId?: string
  /** Optional: Provider für Bild-Auflösung im MarkdownPreview */
  provider?: StorageProvider | null
  /** Optional: Folder-ID (base64) für relative Bilder im MarkdownPreview */
  currentFolderId?: string
  /** Optional: Preview-Modus, blendet Event-spezifische Tools/Debug aus */
  isPreviewOnly?: boolean
}

/**
 * Rendert eine "fertige" Detailansicht als Vorschau.
 * Ziel: Nutzer sieht vor dem Speichern, wie die Detailseite aussieht.
 */
export function PreviewDetailStep({
  detailViewType,
  metadata,
  markdown,
  libraryId,
  provider = null,
  currentFolderId = 'root',
  isPreviewOnly = true,
}: PreviewDetailStepProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-t">
          <DetailViewRenderer
            detailViewType={detailViewType}
            metadata={metadata}
            markdown={markdown}
            libraryId={libraryId}
            showBackLink={false}
            provider={provider}
            currentFolderId={currentFolderId}
            hideEventTools={isPreviewOnly}
            hideDebug={isPreviewOnly}
          />
        </div>
      </CardContent>
    </Card>
  )
}






