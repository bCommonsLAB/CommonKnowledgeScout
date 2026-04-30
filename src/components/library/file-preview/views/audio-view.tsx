'use client';

/**
 * file-preview/views/audio-view.tsx
 *
 * Detail-View fuer Audio-Dateien (Player + Tabs Original/Transcript/
 * Transformation/Story/Uebersicht + Pipeline-Sheet).
 *
 * Aus `file-preview.tsx` PreviewContent-Switch ausgegliedert
 * (Welle 3-II-a Phase 2a, Schritt 4b).
 *
 * Verwendet das gemeinsame `PreviewViewProps`-Bundle aus `./view-props`.
 */

import * as React from 'react'
import { FileText, Sparkles, Upload, RefreshCw } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FileLogger } from '@/lib/debug/logger'
import { SourceAndTranscriptPane } from '@/components/library/shared/source-and-transcript-pane'
import { ArtifactInfoPanel } from '@/components/library/shared/artifact-info-panel'
import { ArtifactMarkdownPanel } from '@/components/library/shared/artifact-markdown-panel'
import { IngestionDetailPanel } from '@/components/library/shared/ingestion-detail-panel'
import { IngestionDataProvider } from '@/components/library/shared/ingestion-data-context'
import { PipelineSheet } from '@/components/library/flow/pipeline-sheet'
import {
  ArtifactTabLabel,
  getStoryStep,
} from '@/components/library/file-preview/artifact-tab-label'
import { JobProgressBar } from '@/components/library/file-preview/job-progress-bar'
import { JobReportTabWithShadowTwin } from '@/components/library/file-preview/job-report-tab-with-shadow-twin'
import {
  ReviewOriginalPane,
  wrapTranscriptTabWithReviewSplit,
} from '@/components/library/file-preview/review-split'
import { TranscriptToolbarActions } from '@/components/library/file-preview/transcript-toolbar-actions'
import type { PreviewViewProps } from './view-props'

export function AudioView(props: PreviewViewProps) {
  const {
    item,
    provider,
    activeLibraryId,
    activeLibrary,
    fileType,
    kind,
    infoTab,
    setInfoTab,
    shadowTwinState,
    storySteps,
    transcript,
    displayTranscriptItem,
    transcriptHeaderExtra,
    transformItem,
    transformError,
    transformHeaderExtra,
    hasActiveJob,
    currentJobInfo,
    isRunningPipeline,
    openPipelineForPhase,
    effectiveMdIdRef,
    isReviewMode,
    handleReviewModeToggle,
    isSplittingPages,
    setIsSplittingPages,
    onRefreshFolder,
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

  FileLogger.debug('AudioView', 'Audio-Player wird gerendert', {
    itemId: item.id,
    itemName: item.metadata.name,
  })

  if (!provider) {
    return <div className="text-sm text-muted-foreground">Kein Provider verfuegbar.</div>
  }

  const docModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
    ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
    : undefined
  const textStep = getStoryStep(storySteps, 'text')
  const transformStep = getStoryStep(storySteps, 'transform')
  const publishStep = getStoryStep(storySteps, 'publish')

  return (
    <IngestionDataProvider
      libraryId={activeLibraryId}
      fileId={item.id}
      docModifiedAt={docModifiedAt}
      includeChapters={true}
    >
      {/* Job-Progress-Anzeige wenn ein Job laeuft */}
      {hasActiveJob && currentJobInfo && (
        <JobProgressBar
          status={currentJobInfo.status}
          progress={currentJobInfo.progress}
          message={currentJobInfo.message}
          phase={currentJobInfo.phase}
        />
      )}
      <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as typeof infoTab)} className="flex h-full flex-col">
        {/* Tabs folgen dem Artefakt-Lebenszyklus (Original -> Transcript -> Transform -> Story -> Uebersicht). */}
        <TabsList className="mx-3 mt-3 w-fit">
          <TabsTrigger value="original">Original</TabsTrigger>
          <TabsTrigger value="transcript">
            <ArtifactTabLabel label="Transkript" icon={FileText} state={textStep?.state || null} />
          </TabsTrigger>
          <TabsTrigger value="transform">
            <ArtifactTabLabel label="Transformation" icon={Sparkles} state={transformStep?.state || null} />
          </TabsTrigger>
          <TabsTrigger value="story">
            <ArtifactTabLabel label="Story" icon={Upload} state={publishStep?.state || null} />
          </TabsTrigger>
          <TabsTrigger value="overview">Uebersicht</TabsTrigger>
        </TabsList>

        <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
          <div className="h-full overflow-hidden rounded border">
            <SourceAndTranscriptPane
              provider={provider}
              libraryId={activeLibraryId}
              sourceFile={item}
              streamingUrl={null}
              transcriptItem={transcript.transcriptItem}
              leftPaneMode="audio"
            />
          </div>
        </TabsContent>

        <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-3">
          {wrapTranscriptTabWithReviewSplit(
            isReviewMode,
            <ReviewOriginalPane provider={provider} item={item} streamingUrl={null} />,
            <ArtifactMarkdownPanel
              title="Transcript (aus dem Original transkribiert)"
              titleClassName="text-xs text-muted-foreground font-normal"
              headerExtra={transcriptHeaderExtra}
              item={displayTranscriptItem}
              provider={provider}
              libraryId={activeLibraryId || undefined}
              emptyHint="Noch kein Transkript vorhanden."
              additionalActions={
                <TranscriptToolbarActions
                  isReviewMode={isReviewMode}
                  onToggleReviewMode={handleReviewModeToggle}
                  hasTranscriptItem={!!transcript.transcriptItem}
                  transcriptToolsEligible={
                    !!(transcript.transcriptItem &&
                      ['pdf', 'audio', 'markdown', 'docx', 'xlsx', 'pptx'].includes(fileType))
                  }
                  isPdf={false}
                  isSplittingPages={isSplittingPages}
                  setIsSplittingPages={setIsSplittingPages}
                  isRunningPipeline={isRunningPipeline}
                  hasActiveJob={hasActiveJob}
                  openPipelineForPhase={openPipelineForPhase}
                  activeLibraryId={activeLibraryId}
                  transcriptItem={transcript.transcriptItem}
                  sourceItem={item}
                  provider={provider}
                  onRefreshFolder={onRefreshFolder}
                />
              }
            />,
          )}
        </TabsContent>

        <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Story-Inhalte und Metadaten (aus dem Transkript transformiert)
              </div>
              <div className="flex items-center gap-2">
                {transformHeaderExtra}
                {!transformItem ? (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => openPipelineForPhase('transform')}
                    disabled={isRunningPipeline || hasActiveJob}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Jetzt erstellen
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openPipelineForPhase('transform', true)}
                    disabled={isRunningPipeline || hasActiveJob}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Neu generieren
                  </Button>
                )}
              </div>
            </div>
            {transformError ? (
              <Alert variant="destructive">
                <AlertDescription>{transformError}</AlertDescription>
              </Alert>
            ) : !transformItem ? (
              <div className="rounded border p-3 text-sm text-muted-foreground">
                Keine Transformationsdaten vorhanden. Bitte stellen Sie sicher, dass die Datei verarbeitet wurde.
              </div>
            ) : (
              <div className="rounded border">
                <JobReportTabWithShadowTwin
                  libraryId={activeLibraryId}
                  fileId={item.id}
                  fileName={item.metadata.name}
                  parentId={item.parentId}
                  provider={provider}
                  resolvedMdFileId={transformItem?.id ?? undefined}
                  ingestionTabMode="preview"
                  effectiveMdIdRef={effectiveMdIdRef}
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
          {infoTab === 'story' ? (
            <div className="h-full overflow-auto rounded border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  veroeffentlichte Story (aus den Artefakten der Transformation erstellt) ·
                  Diese Ansicht entspricht der Gallery-Detail Ansicht. ·
                  Uebersetzungen werden separat ueber die Galerie-Tabelle ausgeloest (Publish-Button pro Dokument).
                </div>
                {publishStep?.state === 'missing' ? (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => openPipelineForPhase('story')}
                    disabled={isRunningPipeline || hasActiveJob}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Jetzt erstellen
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openPipelineForPhase('story', true)}
                    disabled={isRunningPipeline || hasActiveJob}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Erneut publizieren
                  </Button>
                )}
              </div>
              <IngestionDetailPanel libraryId={activeLibraryId} fileId={item.id} />
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-3">
          {infoTab === 'overview' ? (
            <div className="rounded border">
              <ArtifactInfoPanel
                libraryId={activeLibraryId}
                sourceFile={item}
                shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                transcriptFiles={shadowTwinState?.transcriptFiles}
                transformed={shadowTwinState?.transformed}
                targetLanguage="de"
              />
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
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
          hasTranscript: !!transcript.transcriptItem,
          hasTransformed: !!shadowTwinState?.transformed,
          hasIngested: publishStep?.state !== 'missing',
        }}
        defaultGenerateCoverImage={activeLibrary?.config?.secretaryService?.generateCoverImage}
        defaultCustomHint={savedCustomHint}
      />
    </IngestionDataProvider>
  )
}
