'use client';

/**
 * file-preview/views/default-view.tsx
 *
 * Detail-View fuer Dateitypen, fuer die keine spezialisierte View
 * existiert (Fallback im PreviewContent-Switch). Zeigt eine
 * Hinweis-Box und stellt zusaetzlich das PipelineSheet bereit, damit
 * der User trotzdem eine Pipeline starten kann (z.B. um den Dateityp
 * via Custom-Hint zu klassifizieren).
 *
 * Aus `file-preview.tsx` PreviewContent-Switch (default:) ausgegliedert
 * (Welle 3-II-a Phase 2b, Schritt 4b).
 *
 * Existing-Artifacts werden hardcoded auf `false` gesetzt — bei
 * unbekanntem Dateityp existieren in der Regel weder Transcript noch
 * Transformation noch Ingestion-Output. Dieses Verhalten entspricht
 * 1:1 dem Original-Switch.
 *
 * Verwendet das gemeinsame `PreviewViewProps`-Bundle aus `./view-props`.
 */

import * as React from 'react'
import { PipelineSheet } from '@/components/library/flow/pipeline-sheet'
import type { PreviewViewProps } from './view-props'

export function DefaultView(props: PreviewViewProps) {
  const {
    item,
    activeLibraryId,
    activeLibrary,
    kind,
    isPipelineOpen,
    setIsPipelineOpen,
    effectiveTargetLanguage,
    setTargetLanguage,
    sourceLanguage,
    setSourceLanguage,
    templateName,
    setTemplateName,
    templates,
    isLoadingTemplates,
    llmModel,
    setLlmModel,
    llmModels,
    isLoadingLlmModels,
    runPipeline,
    pipelineDefaultSteps,
    pipelineDefaultForce,
    savedCustomHint,
  } = props

  return (
    <>
      <div className="text-center text-muted-foreground">
        Keine Vorschau verfuegbar fuer diesen Dateityp.
      </div>
      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={setIsPipelineOpen}
        libraryId={activeLibraryId}
        sourceFileName={item.metadata.name}
        kind={(['pdf', 'audio', 'video', 'markdown'].includes(kind)
          ? kind
          : (['docx', 'xlsx', 'pptx'].includes(kind) ? 'office' : 'other')) as 'pdf' | 'audio' | 'video' | 'markdown' | 'office' | 'other'}
        targetLanguage={effectiveTargetLanguage}
        onTargetLanguageChange={setTargetLanguage}
        sourceLanguage={sourceLanguage}
        onSourceLanguageChange={setSourceLanguage}
        templateName={templateName}
        onTemplateNameChange={setTemplateName}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        llmModel={llmModel}
        onLlmModelChange={setLlmModel}
        llmModels={llmModels}
        isLoadingLlmModels={isLoadingLlmModels}
        onStart={runPipeline}
        defaultSteps={pipelineDefaultSteps}
        defaultForce={pipelineDefaultForce}
        existingArtifacts={{
          hasTranscript: false,
          hasTransformed: false,
          hasIngested: false,
        }}
        defaultGenerateCoverImage={activeLibrary?.config?.secretaryService?.generateCoverImage}
        defaultCustomHint={savedCustomHint}
      />
    </>
  )
}
