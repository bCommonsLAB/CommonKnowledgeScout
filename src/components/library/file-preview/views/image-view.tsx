'use client';

/**
 * file-preview/views/image-view.tsx
 *
 * Detail-View fuer Bild-Dateien. Tabs: Original (ImagePreview),
 * Analyse (Transformation), Story, Uebersicht. **Kein Transcript-Tab**
 * (Bilder werden nicht transkribiert).
 *
 * Aus `file-preview.tsx` PreviewContent-Switch ausgegliedert
 * (Welle 3-II-a Phase 2a, Schritt 4b).
 */

import * as React from 'react'
import { Sparkles, Upload, RefreshCw } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FileLogger } from '@/lib/debug/logger'
import { ImagePreview } from '@/components/library/image-preview'
import { ArtifactInfoPanel } from '@/components/library/shared/artifact-info-panel'
import { IngestionDetailPanel } from '@/components/library/shared/ingestion-detail-panel'
import { IngestionDataProvider } from '@/components/library/shared/ingestion-data-context'
import { PipelineSheet } from '@/components/library/flow/pipeline-sheet'
import {
  ArtifactTabLabel,
  getStoryStep,
} from '@/components/library/file-preview/artifact-tab-label'
import { JobProgressBar } from '@/components/library/file-preview/job-progress-bar'
import { JobReportTabWithShadowTwin } from '@/components/library/file-preview/job-report-tab-with-shadow-twin'
import { useDivaSupplierData } from '@/components/library/file-preview/use-diva-supplier-data'
import { DivaSupplierDataView } from './diva-supplier-data-view'
import { DivaSupplierNoMatchView } from './diva-supplier-no-match-view'
import type { PreviewViewProps } from './view-props'

export function ImageView(props: PreviewViewProps) {
  const {
    item,
    provider,
    activeLibraryId,
    activeLibrary,
    infoTab,
    setInfoTab,
    shadowTwinState,
    storySteps,
    transformItem,
    transformError,
    transformHeaderExtra,
    hasActiveJob,
    currentJobInfo,
    isRunningPipeline,
    openPipelineForPhase,
    effectiveMdIdRef,
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

  FileLogger.info('ImageView', 'ImagePreview mit Pipeline wird gerendert', {
    itemId: item.id,
    itemName: item.metadata.name,
    mimeType: item.metadata.mimeType,
  })

  // DIVA-Info: nur laden, wenn das Library-Flag gesetzt ist. Der Tab erscheint
  // nur bei einem Sidecar-Treffer (Plan Phase A/B).
  const divaEnabled = activeLibrary?.config?.analyzeDivaTextureInfo === true
  const diva = useDivaSupplierData({
    enabled: divaEnabled,
    libraryId: activeLibraryId,
    fileId: item.id,
  })
  const divaEntry = diva.data?.entry
  const divaMaterialId = diva.data?.materialId
  const showDivaTab =
    divaEnabled && (diva.sidecarFound || (diva.matched && !!divaEntry && !!divaMaterialId))

  if (!provider) {
    return <div className="text-sm text-muted-foreground">Kein Provider verfuegbar.</div>
  }

  const imgDocModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
    ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
    : undefined
  const imgTransformStep = getStoryStep(storySteps, 'transform')
  const imgPublishStep = getStoryStep(storySteps, 'publish')

  return (
    <IngestionDataProvider
      libraryId={activeLibraryId}
      fileId={item.id}
      docModifiedAt={imgDocModifiedAt}
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
          <TabsTrigger value="transform">
            <ArtifactTabLabel label="Analyse" icon={Sparkles} state={imgTransformStep?.state || null} />
          </TabsTrigger>
          <TabsTrigger value="story">
            <ArtifactTabLabel label="Story" icon={Upload} state={imgPublishStep?.state || null} />
          </TabsTrigger>
          <TabsTrigger value="overview">Uebersicht</TabsTrigger>
          {showDivaTab ? <TabsTrigger value="diva-info">DIVA-Info</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
          <div className="h-full overflow-hidden rounded border">
            <ImagePreview
              provider={provider}
              activeLibraryId={activeLibraryId}
              onRefreshFolder={onRefreshFolder}
              showTransformControls={false}
            />
          </div>
        </TabsContent>

        <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Bild-Analyse und extrahierte Metadaten (via Image-Analyzer)
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
                    Jetzt analysieren
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openPipelineForPhase('transform', true)}
                    disabled={isRunningPipeline || hasActiveJob}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Neu analysieren
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
                Noch keine Analyse vorhanden. Klicken Sie auf &quot;Jetzt analysieren&quot;,
                um die Bild-Analyse zu starten.
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
                  veroeffentlichte Story (aus der Bild-Analyse erstellt) ·
                  Uebersetzungen werden separat ueber die Galerie-Tabelle ausgeloest (Publish-Button pro Dokument).
                </div>
                {imgPublishStep?.state === 'missing' ? (
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

        {showDivaTab ? (
          <TabsContent value="diva-info" className="min-h-0 flex-1 overflow-auto p-3">
            {infoTab === 'diva-info' ? (
              diva.matched && divaEntry && divaMaterialId ? (
                <DivaSupplierDataView
                  provider={provider}
                  activeLibraryId={activeLibraryId}
                  item={item}
                  entry={divaEntry}
                  materialId={divaMaterialId}
                  strategy={diva.data?.strategy}
                />
              ) : (
                <DivaSupplierNoMatchView
                  fileName={item.metadata.name}
                  entryCount={diva.data?.entryCount ?? 0}
                  attempts={diva.data?.attempts ?? []}
                />
              )
            ) : null}
          </TabsContent>
        ) : null}
      </Tabs>
      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={setIsPipelineOpen}
        libraryId={activeLibraryId}
        sourceFileName={item.metadata.name}
        kind="image"
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
          hasTransformed: !!shadowTwinState?.transformed,
          hasIngested: imgPublishStep?.state !== 'missing',
        }}
        defaultGenerateCoverImage={activeLibrary?.config?.secretaryService?.generateCoverImage}
        defaultCustomHint={savedCustomHint}
      />
    </IngestionDataProvider>
  )
}
