/**
 * editDraft-Renderer der Wizard-Engine (Sub-Welle 3-VI-d / U1).
 * Verbatim aus `creation-wizard.tsx` herausgelöst: Feld-Auswahl (O1),
 * PDF-HITL-Guards, Bildfeld-Extraktion und DSGVO-konformes Logging.
 */

import type { ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { resolveEditableFields } from "@/lib/creation/editable-fields"
import { EditDraftStep } from "../../steps/edit-draft-step"
import type { StepRenderContext } from "../step-render-context"
import { selectCanonicalMetadata, selectCanonicalMarkdown } from "../wizard-metadata"

export function renderEditDraftStep(ctx: StepRenderContext): ReactNode {
  const { templateId, template, currentStep, wizardState, setWizardState, libraryId, scheduleMetadataEditedLog } = ctx
  const isPdfAnalyse = (templateId || '').toLowerCase() === 'pdfanalyse'
  // Initialisiere draftMetadata/draftText falls noch nicht vorhanden
  const initialMetadata = selectCanonicalMetadata(wizardState)
  const initialDraftText = selectCanonicalMarkdown(wizardState)

  // Feld-Auswahl + Kompatibilitätsprüfung (ADR-0003 / O1): editDraft.fields als
  // optionaler Override, sonst generisch aus dem Schema. Statt stillem Fallback
  // jetzt ein klarer Fehler (UX C3) bei kaputter/leerer Vorlage.
  const resolution = resolveEditableFields({
    schemaFieldKeys: template.metadata.fields.map((f) => f.key),
    overrideFields: currentStep.fields,
  })

  // PDF-HITL: Wenn wir hier ohne Draft landen, ist das ein Flow-Fehler (sonst sieht man "leere" Screens).
  if (isPdfAnalyse && Object.keys(initialMetadata).length === 0 && initialDraftText.trim().length === 0) {
    return (
      <Alert>
        <AlertTitle>Keine Metadaten vorhanden</AlertTitle>
        <AlertDescription>
          Es wurden noch keine Metadaten/Markdown erzeugt. Bitte gehe zurück und starte zuerst OCR (und danach Template/Metadaten).
        </AlertDescription>
      </Alert>
    )
  }

  // Kompatibilitätsprüfung: kaputte/leere Vorlage -> klare Meldung (freundlich,
  // technischer Grund im Details-Aufklapper) statt stillem Verhalten.
  if (!resolution.ok) {
    const detail =
      resolution.reason === 'missing-bound-fields'
        ? `Im Schema fehlende, gebundene Felder: ${(resolution.missingFields ?? []).join(', ')}`
        : 'Das Schema enthält kein bearbeitbares Inhaltsfeld.'
    return (
      <Alert>
        <AlertTitle>Diese Vorlage ist unvollständig</AlertTitle>
        <AlertDescription>
          Sie kann gerade nicht zum Bearbeiten verwendet werden. Bitte wende dich an die Administration.
          <details className="mt-2">
            <summary className="cursor-pointer text-xs">Technische Details</summary>
            <div className="mt-1 text-xs">{detail}</div>
          </details>
        </AlertDescription>
      </Alert>
    )
  }

  const userRelevantFields = resolution.fields

  // Markdown-Tab nur anzeigen, wenn Text vorhanden ist (Diktat: Tabs aus — nur Dateiname)
  const isBuiltinDictation = templateId === 'audio-transcript-de'
  const showMarkdownTab = initialDraftText.trim().length > 0

  // Bildfelder: aus editDraft.imageFieldKeys (falls definiert)
  const imageFieldKeys = currentStep.imageFieldKeys && currentStep.imageFieldKeys.length > 0
    ? currentStep.imageFieldKeys
    : undefined

  return (
    <EditDraftStep
      templateMetadata={template.metadata}
      draftMetadata={initialMetadata}
      draftText={initialDraftText}
      sources={wizardState.sources}
      // Nur benutzerrelevante Felder anzeigen (aus editDraft.fields)
      userRelevantFields={userRelevantFields}
      showMarkdownTab={showMarkdownTab}
      suppressMarkdownTab={isBuiltinDictation}
      headingOverride={currentStep.title}
      subheadingOverride={currentStep.description}
      hideSourcesFooter={isBuiltinDictation}
      imageFieldKeys={imageFieldKeys}
      libraryId={libraryId}
      onMetadataChange={(metadata) => {
        setWizardState((prev) => {
          // Extrahiere Bild-URLs (Strings und Arrays)
          const newImageUrls: Record<string, string | string[]> = {}
          if (imageFieldKeys) {
            for (const key of imageFieldKeys) {
              const value = metadata[key]
              if (typeof value === 'string' && value.trim().length > 0) {
                newImageUrls[key] = value
              } else if (Array.isArray(value) && value.length > 0) {
                newImageUrls[key] = value as string[]
              }
            }
          }
          return {
            ...prev,
            draftMetadata: metadata,
            reviewedFields: metadata,
            imageUrls: {
              ...(prev.imageUrls || {}),
              ...newImageUrls
            }
          }
        })

        // DSGVO: nur Keys/Counts loggen, kein Inhalt
        scheduleMetadataEditedLog(metadata)
      }}
      onDraftTextChange={(text) => {
        setWizardState((prev) => ({ ...prev, draftText: text }))
      }}
    />
  )
}
