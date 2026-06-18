/**
 * selectSchemaType-Renderer der Wizard-Engine (U6b).
 *
 * Verdrahtet den Inhaltstyp-Auswahl-Step: schreibt die Wahl in
 * `wizardState.selectedDetailViewType`. Der Compute-Schritt (handleNext) liest
 * sie für das Analyse-Standard-Template + den Submission-detailViewType.
 */

import type { ReactNode } from "react"
import { SelectSchemaTypeStep } from "../../steps/select-schema-type-step"
import type { StepRenderContext } from "../step-render-context"

export function renderSelectSchemaTypeStep(ctx: StepRenderContext): ReactNode {
  const { wizardState, setWizardState } = ctx
  return (
    <SelectSchemaTypeStep
      selected={wizardState.selectedDetailViewType}
      onSelect={(detailViewType) => {
        // Inhaltstyp wählen schließt „Nur transkribieren" aus (gegenseitig exklusiv, 5a).
        setWizardState((prev) => ({
          ...prev,
          selectedDetailViewType: detailViewType,
          captureTranscriptOnly: false,
        }))
      }}
      transcriptOnly={wizardState.captureTranscriptOnly}
      onSelectTranscriptOnly={() => {
        // „Nur transkribieren" schließt die Inhaltstyp-Wahl aus (5a).
        setWizardState((prev) => ({
          ...prev,
          captureTranscriptOnly: true,
          selectedDetailViewType: undefined,
        }))
      }}
      isProcessing={wizardState.isExtracting}
      processingProgress={wizardState.processingProgress}
      processingMessage={wizardState.processingMessage}
      processingPhase={wizardState.processingPhase}
      error={wizardState.extractionError}
    />
  )
}
