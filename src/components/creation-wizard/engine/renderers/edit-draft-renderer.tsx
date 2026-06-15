/**
 * editDraft-Renderer der Wizard-Engine (Sub-Welle 3-VI-d / U1).
 * Verbatim aus `creation-wizard.tsx` herausgelöst: Feld-Auswahl (O1),
 * PDF-HITL-Guards, Bildfeld-Extraktion und DSGVO-konformes Logging.
 */

import type { ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { editableContentFields } from "@/lib/creation/editable-fields"
import { EditDraftStep } from "../../steps/edit-draft-step"
import type { StepRenderContext } from "../step-render-context"
import { selectCanonicalMetadata, selectCanonicalMarkdown } from "../wizard-metadata"

export function renderEditDraftStep(ctx: StepRenderContext): ReactNode {
  const { templateId, template, currentStep, wizardState, setWizardState, libraryId, scheduleMetadataEditedLog } = ctx
  const isPdfAnalyse = (templateId || '').toLowerCase() === 'pdfanalyse'
  // Initialisiere draftMetadata/draftText falls noch nicht vorhanden
  const initialMetadata = selectCanonicalMetadata(wizardState)
  const initialDraftText = selectCanonicalMarkdown(wizardState)

  // Feld-Auswahl (ADR-0003 / O1, Phase 3a): editDraft.fields als optionaler
  // Override; sonst GENERISCH aus dem Schema ableiten (Inhalts-Felder ohne
  // System-/Struktur-Felder) statt still auf ALLE Felder zu fallen.
  const derivedEditableFields = editableContentFields(template.metadata.fields.map((f) => f.key))
  const userRelevantFields = currentStep.fields && currentStep.fields.length > 0
    ? currentStep.fields
    : (derivedEditableFields.length > 0 ? derivedEditableFields : undefined)

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

  // Wenn Felder definiert sind, zeige den Step auch bei leerem Metadata (User kann direkt eingeben)
  // Wenn keine Felder definiert sind UND Metadata leer ist, zeige Fehlermeldung
  if (!userRelevantFields && Object.keys(initialMetadata).length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        Bitte zuerst Eingaben machen (URL/Text/Datei/Audio).
      </div>
    )
  }

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
