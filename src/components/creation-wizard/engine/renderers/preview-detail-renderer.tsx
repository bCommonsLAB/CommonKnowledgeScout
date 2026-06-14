/**
 * previewDetail-Renderer der Wizard-Engine (Sub-Welle 3-VI-d / U1).
 * Verbatim aus `creation-wizard.tsx`: Metadaten-/Markdown-Auflösung,
 * docType-Heuristik, automatisches Einfügen des ersten Bildes (nach Teaser),
 * PDF-HITL-Guards.
 */

import type { ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PreviewDetailStep } from "../../steps/preview-detail-step"
import type { StepRenderContext } from "../step-render-context"

export function renderPreviewDetailStep(ctx: StepRenderContext): ReactNode {
  const { templateId, typeId, template, creation, wizardState, libraryId, provider, currentFolderId, renderTemplateBody, resolveDetailViewType } = ctx
  const isPdfAnalyse = (templateId || '').toLowerCase() === 'pdfanalyse'
  const baseMetadata =
    wizardState.reviewedFields ||
    wizardState.generatedDraft?.metadata ||
    wizardState.draftMetadata ||
    {}

  // Merge Bild-URLs in baseMetadata für Preview
  const metadataWithImages = {
    ...baseMetadata,
    ...(wizardState.imageUrls || {}),
  }

  // UX/SSOT: Preview soll den korrekten docType anzeigen (z.B. Badge "Event").
  // Der docType wird sonst erst beim Speichern via applyEventFrontmatterDefaults gesetzt.
  // Für die Vorschau reichen Minimal-Heuristiken.
  const previewMetadata: Record<string, unknown> = { ...metadataWithImages }
  const currentDocType = typeof previewMetadata.docType === 'string' ? previewMetadata.docType.trim().toLowerCase() : ''
  const typeIdLower = String(typeId || '').toLowerCase()
  if (!currentDocType && typeIdLower.includes('event')) {
    previewMetadata.docType = 'event'
    // eventStatus ist optional, hilft aber beim UI-Labeling
    if (previewMetadata.eventStatus === undefined) previewMetadata.eventStatus = 'open'
  }

  const preferredPreviewMarkdown =
    wizardState.generatedDraft?.markdown ||
    wizardState.draftText ||
    ""

  // Wenn kein Markdown vorhanden ist, rendere es aus template.markdownBody (z.B. {{summaryInText}})
  let previewMarkdown =
    preferredPreviewMarkdown.trim().length > 0
      ? preferredPreviewMarkdown
      : renderTemplateBody({ body: template.markdownBody || "", values: metadataWithImages })

  // Füge Bild automatisch oben im Preview-Markdown ein (nach Teaser, falls vorhanden)
  const uploadImagesStep = creation?.flow.steps.find((step) => step.preset === 'uploadImages')
  const imageFieldKeys = uploadImagesStep?.fields || []

  // Finde das erste Bildfeld mit einer URL
  let firstImageUrl: string | undefined
  let firstImageKey: string | undefined
  for (const fieldKey of imageFieldKeys) {
    const imageUrl = wizardState.imageUrls?.[fieldKey] || metadataWithImages[fieldKey]
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
      firstImageUrl = imageUrl
      firstImageKey = fieldKey
      break
    }
  }

  if (firstImageUrl && firstImageKey) {
    // Prüfe, ob Bild bereits im Markdown vorhanden ist
    if (!previewMarkdown.includes(firstImageUrl)) {
      // Suche nach Teaser im Markdown (verschiedene Formate)
      const teaserText = metadataWithImages.teaser as string | undefined
      let teaserMatch: RegExpMatchArray | null = null
      let teaserEnd = 0

      if (teaserText && typeof teaserText === 'string' && teaserText.trim().length > 0) {
        // Suche nach Teaser-Text im Markdown (erste 100 Zeichen für Matching)
        const teaserSnippet = teaserText.substring(0, 100).trim()
        const escapedSnippet = teaserSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const teaserPattern = new RegExp(`(${escapedSnippet})`, 'i')
        teaserMatch = previewMarkdown.match(teaserPattern)

        if (teaserMatch && teaserMatch.index !== undefined) {
          // Finde das Ende des Absatzes nach dem Teaser
          const afterTeaserStart = teaserMatch.index + teaserMatch[0].length
          const afterTeaser = previewMarkdown.substring(afterTeaserStart)
          const nextParagraphMatch = afterTeaser.match(/\n\n|\n##/)
          teaserEnd = nextParagraphMatch
            ? afterTeaserStart + nextParagraphMatch.index! + nextParagraphMatch[0].length
            : afterTeaserStart + afterTeaser.length
        }
      }

      // Fallback: Suche nach "Teaser:" Label
      if (!teaserMatch) {
        const teaserLabelPattern = /(?:^|\n)(?:##\s+)?Teaser[:\s]*\n([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n##|$)/i
        const labelMatch = previewMarkdown.match(teaserLabelPattern)
        if (labelMatch && labelMatch.index !== undefined) {
          teaserEnd = labelMatch.index + labelMatch[0].length
          teaserMatch = labelMatch
        }
      }

      if (teaserMatch && teaserEnd > 0) {
        // Teaser gefunden: Füge Bild direkt nach Teaser ein
        const beforeTeaser = previewMarkdown.substring(0, teaserEnd)
        const afterTeaser = previewMarkdown.substring(teaserEnd)
        previewMarkdown = beforeTeaser + `\n\n![${firstImageKey}](${firstImageUrl})\n\n` + afterTeaser
      } else {
        // Kein Teaser gefunden: Füge Bild ganz oben ein
        previewMarkdown = `![${firstImageKey}](${firstImageUrl})\n\n` + previewMarkdown
      }
    }
  }

  const detailViewType = resolveDetailViewType()

  if (isPdfAnalyse && Object.keys(baseMetadata).length === 0 && preferredPreviewMarkdown.trim().length === 0) {
    return (
      <Alert>
        <AlertTitle>Keine Vorschau verfügbar</AlertTitle>
        <AlertDescription>
          Es gibt noch keine Metadaten/Markdown für die Vorschau. Bitte gehe zurück und führe zuerst OCR + Template aus.
        </AlertDescription>
      </Alert>
    )
  }

  if (Object.keys(baseMetadata).length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        Bitte zuerst Daten ausfüllen oder auslesen.
      </div>
    )
  }

  return (
    <PreviewDetailStep
      detailViewType={detailViewType}
      metadata={previewMetadata}
      markdown={previewMarkdown}
      libraryId={libraryId}
      provider={provider}
      currentFolderId={wizardState.pdfTranscriptFolderId || currentFolderId || 'root'}
    />
  )
}
