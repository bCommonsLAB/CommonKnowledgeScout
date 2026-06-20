'use client';

/**
 * file-preview/views/markdown-view.tsx
 *
 * Detail-View fuer Markdown-Dateien (.md). Zeigt MarkdownPreview mit
 * Edit-Dialog im Original-Tab + Tabs Original/Transcript/Transformation/
 * Story/Uebersicht + Pipeline-Sheet.
 *
 * Aus `file-preview.tsx` PreviewContent-Switch (case 'markdown')
 * ausgegliedert (Welle 3-II-a Phase 2d, Schritt 2/4).
 *
 * Funktionale Eigenheiten gegenueber Audio/Video/PDF/Office:
 * - Original-Tab nutzt MarkdownPreview (NICHT SourceAndTranscriptPane)
 * - Edit-Button + ArtifactEditDialog fuer Inline-Bearbeitung
 * - Transcript-Tab hat KEIN Review-Split (Original-Markdown ist
 *   bereits maschinenlesbar)
 * - Transcript-Tab hat 2 Code-Pfade: Mongo-Transkript ODER
 *   Original-Inhalt-Fallback
 * - Story-Tab hat den vollen Beschreibungstext (incl. "Gallery-Detail")
 *
 * Verwendet das gemeinsame `PreviewViewProps`-Bundle aus `./view-props`
 * — inkl. der markdown-spezifischen optionalen Felder (`content`,
 * `currentFolderId`, `compositeWikiPreview`, edit-handlers).
 */

import * as React from 'react'
import { FileText, Sparkles, Upload, RefreshCw } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FileLogger } from '@/lib/debug/logger'
import { MarkdownPreview } from '@/components/library/markdown-preview'
import { extractFrontmatter } from '@/components/library/markdown-metadata'
import { ArtifactInfoPanel } from '@/components/library/shared/artifact-info-panel'
import { ArtifactMarkdownPanel } from '@/components/library/shared/artifact-markdown-panel'
import { ArtifactEditDialog } from '@/components/library/shared/artifact-edit-dialog'
import { IngestionDetailPanel } from '@/components/library/shared/ingestion-detail-panel'
import { IngestionDataProvider } from '@/components/library/shared/ingestion-data-context'
import { PipelineSheet } from '@/components/library/flow/pipeline-sheet'
import {
  ArtifactTabLabel,
  getStoryStep,
} from '@/components/library/file-preview/artifact-tab-label'
import { JobProgressBar } from '@/components/library/file-preview/job-progress-bar'
import { JobReportTabWithShadowTwin } from '@/components/library/file-preview/job-report-tab-with-shadow-twin'
import type { PreviewViewProps } from './view-props'

export function MarkdownView(props: PreviewViewProps) {
  const {
    item,
    provider,
    activeLibraryId,
    activeLibrary,
    kind,
    infoTab,
    setInfoTab,
    shadowTwinState,
    storySteps,
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
    // Markdown-spezifisch (Phase 2d):
    content,
    currentFolderId,
    compositeWikiPreview,
    isEditOpen,
    setIsEditOpen,
    contentCache,
    onContentUpdated,
    setSelectedFile,
  } = props

  // Edit-Save-Handler. Liest den neuen Inhalt aus dem Storage,
  // mutiert den contentCache und triggert das umliegende FilePreview-
  // Reducer-Update via onContentUpdated. Bestands-Eigenheit (1:1
  // portiert): Setzt das selectedFile-Atom und refresht den Folder.
  //
  // WICHTIG: Hook MUSS vor dem fruehen return stehen
  // (react-hooks/rules-of-hooks).
  const handleSaved = React.useCallback(
    (saved: typeof item) => {
      if (!provider) return
      const loadSavedContent = async () => {
        const { blob } = await provider.getBinary(saved.id)
        const text = await blob.text()
        contentCache?.current.delete(item.id)
        contentCache?.current.set(saved.id, {
          content: text,
          hasMetadata: !!extractFrontmatter(text),
        })
        onContentUpdated?.(text)
        setSelectedFile?.(saved)
        if (onRefreshFolder) {
          const updatedItems = await provider.listItemsById(saved.parentId)
          onRefreshFolder(saved.parentId, updatedItems, saved)
        }
      }
      loadSavedContent().catch((error) => {
        FileLogger.error('MarkdownView', 'Fehler beim Aktualisieren nach Edit', { error })
      })
    },
    [item.id, provider, contentCache, onContentUpdated, setSelectedFile, onRefreshFolder],
  )

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
          <div className="h-full overflow-hidden rounded border p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-muted-foreground font-normal">
                Original (Markdown-Datei)
              </div>
              <Button size="sm" variant="outline" onClick={() => setIsEditOpen?.(true)} disabled={!provider}>
                Bearbeiten
              </Button>
            </div>
            <div className="rounded border">
              <MarkdownPreview
                content={content ?? ''}
                currentFolderId={currentFolderId}
                provider={provider}
                className="max-h-[70vh]"
                compact
                onRefreshFolder={onRefreshFolder}
                compositeWikiPreview={compositeWikiPreview ?? null}
                onTransform={() => {
                  // Transform-Button wurde geklickt — wechsle zum Transform-Tab.
                  setInfoTab('transform')
                }}
              />
            </div>
            <ArtifactEditDialog
              open={!!isEditOpen}
              onOpenChange={setIsEditOpen ?? (() => {})}
              item={item}
              provider={provider}
              libraryId={activeLibraryId || undefined}
              onSaved={handleSaved}
            />
          </div>
        </TabsContent>

        <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-3">
          <div className="h-full overflow-hidden rounded border p-3">
            {/* Bei Mongo-Mode: Transkript aus MongoDB anzeigen
                (enthaelt Quellen-Referenzen + Korpus-Text).
                Ohne MongoDB-Transkript: Original als Fallback anzeigen. */}
            {shadowTwinState?.transcriptFiles && shadowTwinState.transcriptFiles.length > 0 ? (
              <ArtifactMarkdownPanel
                title="Transkript (Quellen + Korpus-Text)"
                titleClassName="text-xs text-muted-foreground font-normal"
                headerExtra={transcriptHeaderExtra}
                item={displayTranscriptItem ?? shadowTwinState.transcriptFiles[0]}
                provider={provider}
                libraryId={activeLibraryId || undefined}
                emptyHint="Transkript konnte nicht geladen werden."
                stripFrontmatter={true}
              />
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Kein separates Transkript vorhanden. Das Original wird als Fallback angezeigt.
                </div>
                <div className="border-t pt-3">
                  <ArtifactMarkdownPanel
                    title="Original-Inhalt"
                    titleClassName="text-xs text-muted-foreground font-normal"
                    item={item}
                    provider={provider}
                    libraryId={activeLibraryId || undefined}
                    emptyHint="Kein Inhalt verfuegbar"
                    stripFrontmatter={false}
                    onSaved={handleSaved}
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Story-Inhalte und Metadaten (aus dem Original transformiert)
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
