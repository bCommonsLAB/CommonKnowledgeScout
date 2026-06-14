/**
 * Step-Registry der datengetriebenen Wizard-Engine (Sub-Welle 3-VI-d / U1).
 *
 * Ersetzt schrittweise den großen `renderStep`-Switch im Monolithen
 * `creation-wizard.tsx` durch eine Tabelle `preset -> Renderer` (Strangler-
 * Migration). Presets, die hier (noch) NICHT eingetragen sind, rendert der
 * Wizard-Kern weiterhin über den Legacy-Switch — so bleibt jeder Schritt
 * verhaltenstreu und einzeln prüfbar.
 *
 * Diese Datei ist reine Verdrahtung; die Renderer liegen unter `renderers/`.
 *
 * @see docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md (Sub-Welle d)
 */

import type { ReactNode } from "react"
import type { CreationFlowStepPreset } from "@/lib/templates/template-types"
import type { StepRenderContext, StepRenderer } from "./step-render-context"
import { renderWelcomeStep, renderCompletionStep } from "./renderers/static-step-renderers"
import {
  renderSelectRelatedTestimonialsStep,
  renderSelectFolderArtifactsStep,
} from "./renderers/selection-step-renderers"
import { renderReviewMarkdownStep, renderGenerateDraftStep } from "./renderers/draft-step-renderers"
import { renderEditDraftStep } from "./renderers/edit-draft-renderer"
import { renderUploadImagesStep } from "./renderers/upload-images-renderer"
import { renderPreviewDetailStep } from "./renderers/preview-detail-renderer"
import { renderCollectSourceStep } from "./renderers/collect-source-renderer"

/**
 * Bereits auf die Engine migrierte Presets. Fehlt ein Preset hier, übernimmt
 * der Legacy-Switch im Wizard-Kern (schrittweise Ablösung).
 */
const STEP_RENDERERS: Partial<Record<CreationFlowStepPreset, StepRenderer>> = {
  welcome: renderWelcomeStep,
  completion: renderCompletionStep,
  selectRelatedTestimonials: renderSelectRelatedTestimonialsStep,
  selectFolderArtifacts: renderSelectFolderArtifactsStep,
  reviewMarkdown: renderReviewMarkdownStep,
  generateDraft: renderGenerateDraftStep,
  editDraft: renderEditDraftStep,
  uploadImages: renderUploadImagesStep,
  previewDetail: renderPreviewDetailStep,
  collectSource: renderCollectSourceStep,
}

/** Ist dieses Preset bereits auf die Engine migriert? */
export function isStepMigrated(preset: CreationFlowStepPreset): boolean {
  return preset in STEP_RENDERERS
}

/**
 * Rendert einen migrierten Step. Liefert `undefined`, wenn das Preset (noch)
 * nicht migriert ist — der Aufrufer fällt dann auf den Legacy-Switch zurück.
 */
export function renderRegisteredStep(
  preset: CreationFlowStepPreset,
  ctx: StepRenderContext
): ReactNode | undefined {
  const renderer = STEP_RENDERERS[preset]
  return renderer ? renderer(ctx) : undefined
}
