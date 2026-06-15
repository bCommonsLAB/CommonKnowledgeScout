/**
 * collectSource-Renderer der Wizard-Engine (Sub-Welle 3-VI-d / U1).
 * Verbatim aus `creation-wizard.tsx` herausgelöst.
 *
 * Hinweis: Die `window.__collectSourceStepBeforeLeave`-Brücke lebt weiterhin in
 * `CollectSourceStep` + `handleNext` und wird hier NICHT angefasst — ihre
 * Eliminierung ist Sub-Welle 3-VI-f.
 */

import type { ReactNode } from "react"
import { CollectSourceStep } from "../../steps/collect-source-step"
import type { StepRenderContext } from "../step-render-context"

export function renderCollectSourceStep(ctx: StepRenderContext): ReactNode {
  const {
    wizardState,
    setWizardState,
    addSource,
    removeSource,
    templateId,
    libraryId,
    provider,
    currentFolderId,
    creation,
    template,
    steps,
    setCollectSourceCanProceed,
  } = ctx
  return (
    <CollectSourceStep
      source={wizardState.selectedSource}
      mode={wizardState.mode}
      // Legacy: Fallback für altes System
      onCollect={(content) => {
        setWizardState((prev) => ({
          ...prev,
          collectedInput: {
            type: wizardState.selectedSource!.type,
            content,
          },
        }))
      }}
      onCollectStructured={(result) => {
        setWizardState((prev) => ({
          ...prev,
          generatedDraft: {
            metadata: result.metadata,
            markdown: result.markdown || "",
          },
        }))
      }}
      collectedInput={wizardState.collectedInput?.content}
      // Multi-Source: Neue Props
      sources={wizardState.sources}
      onAddSource={addSource}
      onRemoveSource={removeSource}
      isExtracting={wizardState.isExtracting}
      processingProgress={wizardState.processingProgress}
      processingMessage={wizardState.processingMessage}
      templateId={templateId}
      libraryId={libraryId}
      provider={provider || undefined}
      targetFolderId={currentFolderId}
      // Quelle-Auswahl (wenn source nicht gesetzt). Ordner-Typ „folder“ nur in speziellen Flows (nicht für Diktat).
      supportedSources={creation.supportedSources.filter((s) => s.type !== 'folder')}
      selectedSource={wizardState.selectedSource}
      onSourceSelect={(source) => {
        setWizardState((prev) => ({ ...prev, selectedSource: source }))
      }}
      onModeSelect={(mode) => {
        setWizardState((prev) => ({
          ...prev,
          mode,
          selectedSource: mode === 'form' ? undefined : prev.selectedSource,
          collectedInput: mode === 'form' ? undefined : prev.collectedInput,
        }))
      }}
      onResetSourceSelection={() => {
        // Nutzer möchte die Quelle neu wählen: Auswahl + Eingaben zurücksetzen
        setWizardState((prev) => ({
          ...prev,
          selectedSource: undefined,
          collectedInput: undefined,
          mode: 'interview',
        }))
      }}
      template={template}
      steps={steps}
      onCanProceedChange={setCollectSourceCanProceed}
    />
  )
}
