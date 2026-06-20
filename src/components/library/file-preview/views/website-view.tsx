'use client';

/**
 * file-preview/views/website-view.tsx
 *
 * Detail-View fuer .url-Dateien (gespeicherte Web-Links). Zeigt im
 * Original-Tab eine eingebettete Iframe-Vorschau der Ziel-URL +
 * Tabs Transcript/Transformation/Story/Uebersicht + Pipeline-Sheet.
 *
 * Aus `file-preview.tsx` PreviewContent-Switch (case 'website')
 * ausgegliedert (Welle 3-II-a Phase 2d, Schritt 4/4).
 *
 * Funktionale Eigenheiten gegenueber den anderen Views:
 * - Original-Tab parsed die URL aus dem `content`-Feld (.url-Format:
 *   `URL=https://...`) und zeigt einen Iframe.
 * - Transcript-Tab hat einen verschachtelten Switch:
 *   ReviewMode/NonReviewMode x MongoDB-Transkript/Original-Fallback
 *   (4 Code-Pfade — bewusst 1:1 portiert).
 * - PipelineSheet `kind="other"` ist hardcoded.
 * - Story-Tab hat den kuerzeren Beschreibungstext (wie Office).
 *
 * Verwendet das gemeinsame `PreviewViewProps`-Bundle aus `./view-props`
 * — inkl. `content` (Phase 2d).
 */

import * as React from 'react'
import { ExternalLink, FileText, Sparkles, Upload, RefreshCw } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
  ReviewTranscriptSplit,
  WebsiteReviewOriginalIframe,
} from '@/components/library/file-preview/review-split'
import { TranscriptToolbarActions } from '@/components/library/file-preview/transcript-toolbar-actions'
import type { StorageItem } from '@/lib/storage/types'
import type { PreviewViewProps } from './view-props'

export function WebsiteView(props: PreviewViewProps) {
  const {
    item,
    provider,
    activeLibraryId,
    activeLibrary,
    fileType,
    infoTab,
    setInfoTab,
    shadowTwinState,
    storySteps,
    transcript,
    displayTranscriptItem,
    transcriptHeaderExtra,
    transformItem,
    transformError,
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
    // Website-spezifisch (Phase 2d):
    content,
  } = props

  if (!provider) {
    return <div className="text-sm text-muted-foreground">Kein Provider verfuegbar.</div>
  }

  // URL aus dem .url-Datei-Inhalt parsen (Format: 'URL=https://...').
  const urlContent = (content ?? '').match(/URL=(.*)/i)?.[1]?.trim()
  const docModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
    ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
    : undefined
  const textStep = getStoryStep(storySteps, 'text')
  const transformStep = getStoryStep(storySteps, 'transform')
  const publishStep = getStoryStep(storySteps, 'publish')

  // Wiederverwendbarer ToolbarActions-Block (mit Mongo-Transkript-Item).
  const renderToolbarActionsForMongo = (transcriptItem: StorageItem | null) => (
    <TranscriptToolbarActions
      isReviewMode={isReviewMode}
      onToggleReviewMode={handleReviewModeToggle}
      hasTranscriptItem
      transcriptToolsEligible={false}
      isPdf={false}
      isSplittingPages={isSplittingPages}
      setIsSplittingPages={setIsSplittingPages}
      isRunningPipeline={isRunningPipeline}
      hasActiveJob={hasActiveJob}
      openPipelineForPhase={openPipelineForPhase}
      activeLibraryId={activeLibraryId}
      transcriptItem={transcriptItem ?? null}
      sourceItem={item}
      provider={provider}
      onRefreshFolder={onRefreshFolder}
    />
  )

  // Wiederverwendbarer ToolbarActions-Block (mit aufgeloestem Transcript-Item).
  const renderToolbarActionsForFallback = () => (
    <TranscriptToolbarActions
      isReviewMode={isReviewMode}
      onToggleReviewMode={handleReviewModeToggle}
      hasTranscriptItem={!!transcript.transcriptItem}
      transcriptToolsEligible={
        !!(transcript.transcriptItem &&
          ['pdf', 'audio', 'video', 'markdown', 'docx', 'xlsx', 'pptx'].includes(fileType))
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
  )

  return (
    <IngestionDataProvider
      libraryId={activeLibraryId}
      fileId={item.id}
      docModifiedAt={docModifiedAt}
      includeChapters={true}
    >
      {hasActiveJob && currentJobInfo && (
        <JobProgressBar
          status={currentJobInfo.status}
          progress={currentJobInfo.progress}
          message={currentJobInfo.message}
          phase={currentJobInfo.phase}
        />
      )}
      <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as typeof infoTab)} className="flex h-full flex-col">
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
          <div className="h-full overflow-hidden rounded border flex flex-col">
            {urlContent ? (
              <>
                <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b">
                  <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <a
                    href={urlContent}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate text-sm"
                  >
                    {urlContent}
                  </a>
                </div>
                <div className="relative flex-1 min-h-0">
                  <iframe
                    src={urlContent}
                    title={item.metadata.name}
                    className="w-full h-full absolute inset-0"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  />
                  <div className="absolute inset-0 flex items-center justify-center -z-10 text-muted-foreground text-sm">
                    <p>Website blockiert moeglicherweise die Einbettung.</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
                Keine gueltige URL gefunden.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-3">
          {/* Transcript-Tab hat 4 Code-Pfade: ReviewMode x MongoDB/Fallback.
              1:1 portiert vom Bestands-Switch — eine Vereinheitlichung
              waere ein eigener Refactor (verschachtelter Sub-View). */}
          {isReviewMode ? (
            <ReviewTranscriptSplit
              original={<WebsiteReviewOriginalIframe urlContent={urlContent} label={item.metadata.name} />}
              transcript={
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded border p-3">
                  {shadowTwinState?.transcriptFiles && shadowTwinState.transcriptFiles.length > 0 ? (
                    <ArtifactMarkdownPanel
                      title="Transkript (Website-Inhalt)"
                      titleClassName="text-xs text-muted-foreground font-normal"
                      headerExtra={transcriptHeaderExtra}
                      item={displayTranscriptItem ?? shadowTwinState.transcriptFiles[0]}
                      provider={provider}
                      libraryId={activeLibraryId || undefined}
                      emptyHint="Transkript konnte nicht geladen werden."
                      stripFrontmatter={true}
                      additionalActions={renderToolbarActionsForMongo(
                        displayTranscriptItem ?? shadowTwinState.transcriptFiles[0] ?? null,
                      )}
                    />
                  ) : (
                    <ArtifactMarkdownPanel
                      title="Transkript"
                      titleClassName="text-xs text-muted-foreground font-normal"
                      item={transcript.transcriptItem}
                      provider={provider}
                      libraryId={activeLibraryId || undefined}
                      emptyHint="Noch kein Transkript vorhanden."
                      additionalActions={renderToolbarActionsForFallback()}
                    />
                  )}
                </div>
              }
            />
          ) : (
            <div className="h-full overflow-hidden rounded border p-3">
              {shadowTwinState?.transcriptFiles && shadowTwinState.transcriptFiles.length > 0 ? (
                <ArtifactMarkdownPanel
                  title="Transkript (Website-Inhalt)"
                  titleClassName="text-xs text-muted-foreground font-normal"
                  headerExtra={transcriptHeaderExtra}
                  item={displayTranscriptItem ?? shadowTwinState.transcriptFiles[0]}
                  provider={provider}
                  libraryId={activeLibraryId || undefined}
                  emptyHint="Transkript konnte nicht geladen werden."
                  stripFrontmatter={true}
                  additionalActions={renderToolbarActionsForMongo(
                    displayTranscriptItem ?? shadowTwinState.transcriptFiles[0] ?? null,
                  )}
                />
              ) : (
                <ArtifactMarkdownPanel
                  title="Transkript"
                  titleClassName="text-xs text-muted-foreground font-normal"
                  item={transcript.transcriptItem}
                  provider={provider}
                  libraryId={activeLibraryId || undefined}
                  emptyHint="Noch kein Transkript vorhanden."
                  additionalActions={renderToolbarActionsForFallback()}
                />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Story-Inhalte und Metadaten (aus dem Transkript transformiert)
              </div>
              <div className="flex items-center gap-2">
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
                {/* Website-spezifische Story-Beschreibung (wie Office —
                    kuerzer als Audio/Video/PDF). */}
                <div className="text-xs text-muted-foreground">
                  veroeffentlichte Story (aus den Artefakten der Transformation erstellt) ·
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
        kind="other"
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
          hasTranscript: !!displayTranscriptItem,
          hasTransformed: !!shadowTwinState?.transformed,
          hasIngested: publishStep?.state !== 'missing',
        }}
        defaultGenerateCoverImage={activeLibrary?.config?.secretaryService?.generateCoverImage}
        defaultCustomHint={savedCustomHint}
      />
    </IngestionDataProvider>
  )
}
