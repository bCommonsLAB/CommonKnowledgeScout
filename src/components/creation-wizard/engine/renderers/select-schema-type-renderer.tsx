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
        setWizardState((prev) => ({ ...prev, selectedDetailViewType: detailViewType }))
      }}
      isProcessing={wizardState.isExtracting}
      processingProgress={wizardState.processingProgress}
      processingMessage={wizardState.processingMessage}
      processingPhase={wizardState.processingPhase}
      error={wizardState.extractionError}
    />
  )
}
