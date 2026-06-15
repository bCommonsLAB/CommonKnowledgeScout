/**
 * Entwurfs-Step-Renderer der Wizard-Engine (Sub-Welle 3-VI-d / U1):
 * Markdown-Prüfung + Entwurfs-Generierung. Verbatim aus `creation-wizard.tsx`
 * herausgelöst (inkl. best-effort-Logging).
 */

import type { ReactNode } from "react"
import { GenerateDraftStep } from "../../steps/generate-draft-step"
import { ReviewMarkdownStep } from "../../steps/review-markdown-step"
import { buildCorpusText } from "@/lib/creation/corpus"
import { logWizardEventClient } from "@/lib/wizard-session-logger-client"
import type { StepRenderContext } from "../step-render-context"

export function renderReviewMarkdownStep(ctx: StepRenderContext): ReactNode {
  const { currentStep, wizardState, setWizardState, wizardSessionIdRef, logWizardEvent, provider, currentFolderId } = ctx
  return (
    <ReviewMarkdownStep
      title={currentStep.title || "Markdown prüfen"}
      markdown={wizardState.draftText || ""}
      onMarkdownChange={(next) => setWizardState((prev) => ({ ...prev, draftText: next }))}
      isConfirmed={!!wizardState.hasConfirmedMarkdown}
      onConfirmedChange={(next) => {
        setWizardState((prev) => ({ ...prev, hasConfirmedMarkdown: next }))

        // Log markdown_confirmed Event
        if (next && wizardSessionIdRef.current) {
          logWizardEvent(wizardSessionIdRef.current, {
            eventType: 'markdown_confirmed',
            stepIndex: wizardState.currentStepIndex,
            stepPreset: currentStep.preset,
          }).catch((error) => console.warn('[Wizard] Fehler beim Loggen von markdown_confirmed:', error))
        }
      }}
      isProcessing={wizardState.isExtracting}
      processingProgress={wizardState.processingProgress}
      processingMessage={wizardState.processingMessage}
      provider={provider || null}
      currentFolderId={wizardState.pdfTranscriptFolderId || currentFolderId || 'root'}
    />
  )
}

export function renderGenerateDraftStep(ctx: StepRenderContext): ReactNode {
  const { wizardState, setWizardState, templateId, libraryId, wizardSessionIdRef, currentStep, onNext } = ctx

  // Im Interview-Modus ist generateDraft zwingend nach collectSource.
  // Im Form-Modus kann generateDraft optional sein.
  // Finalize/Seed-Flows können ohne collectedInput arbeiten (Sources sind bereits gesetzt).
  if (wizardState.mode === 'interview' && !wizardState.collectedInput && wizardState.sources.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        Bitte zuerst Eingaben sammeln.
      </div>
    )
  }
  const isEventFinalize = (templateId || '').toLowerCase() === 'event-finalize-de'
  // Im Form-Modus kann generateDraft auch ohne collectedInput aufgerufen werden (z.B. zur Initialbefüllung)
  const inputForGeneration = wizardState.collectedInput?.content || buildCorpusText(wizardState.sources)
  return (
    <GenerateDraftStep
      templateId={templateId}
      libraryId={libraryId}
      input={inputForGeneration}
      onGenerateStarted={() => {
        const sessionId = wizardSessionIdRef.current
        if (!sessionId) return
        void logWizardEventClient(sessionId, {
          eventType: 'job_started',
          stepIndex: wizardState.currentStepIndex,
          stepPreset: currentStep.preset,
          metadata: {
            sourcesCount: wizardState.sources.length,
            corpusLength: inputForGeneration.length,
            templateId,
          },
        })
      }}
      onGenerate={(draft) => {
        setWizardState((prev) => ({
          ...prev,
          generatedDraft: draft,
          // Im Form-Modus: Initialisiere draftMetadata und draftText aus generatedDraft
          draftMetadata: prev.mode === 'form' ? draft.metadata : prev.draftMetadata,
          draftText: prev.mode === 'form' ? draft.markdown : prev.draftText,
        }))
        const sessionId = wizardSessionIdRef.current
        if (!sessionId) return
        void logWizardEventClient(sessionId, {
          eventType: 'job_completed',
          stepIndex: wizardState.currentStepIndex,
          stepPreset: currentStep.preset,
          metadata: {
            sourcesCount: wizardState.sources.length,
            corpusLength: inputForGeneration.length,
            metadataKeys: Object.keys(draft.metadata || {}).length,
            markdownLength: (draft.markdown || '').length,
          },
        })
      }}
      onGenerateFailed={(error) => {
        const sessionId = wizardSessionIdRef.current
        if (!sessionId) return
        const msg = error instanceof Error ? error.message : String(error)
        void logWizardEventClient(sessionId, {
          eventType: 'job_failed',
          stepIndex: wizardState.currentStepIndex,
          stepPreset: currentStep.preset,
          error: { code: 'process_text_failed', message: msg },
        })
      }}
      generatedDraft={wizardState.generatedDraft}
      autoAdvance={isEventFinalize}
      onAdvance={() => onNext()}
      showResultPreview={!isEventFinalize}
    />
  )
}
