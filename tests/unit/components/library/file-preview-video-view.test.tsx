// @vitest-environment jsdom

/**
 * Characterization Tests fuer file-preview/views/video-view.tsx
 * (Welle 3-II-a Phase 2b, Schritt 3 — Sicherheitsnetz vor weiteren View-Splits).
 *
 * Fixiert das Render-Verhalten:
 * - Bei provider=null wird ein "Kein Provider"-Hinweis gerendert.
 * - Mit gueltigen Props rendert die View die 5 Tab-Trigger
 *   (Original, Transkript, Transformation, Story, Uebersicht).
 * - Job-Progress-Bar erscheint, wenn hasActiveJob=true und currentJobInfo
 *   vorhanden.
 *
 * Sub-Komponenten werden gemockt — wir testen nur die Video-View-Schale.
 *
 * Hinweis: Die Implementierung ist 1:1 zu AudioView, mit Ausnahme von
 * `leftPaneMode="video"` und PDF-Tool-Sichtbarkeit. Die Tests sind
 * deshalb bewusst kongruent zu file-preview-audio-view.test.tsx.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { PreviewViewProps, PreviewInfoTab } from '@/components/library/file-preview/views/view-props'

vi.mock('@/components/library/shared/source-and-transcript-pane', () => ({
  SourceAndTranscriptPane: () => <div data-testid="source-pane-mock" />,
}))
vi.mock('@/components/library/shared/artifact-info-panel', () => ({
  ArtifactInfoPanel: () => <div data-testid="info-panel-mock" />,
}))
vi.mock('@/components/library/shared/artifact-markdown-panel', () => ({
  ArtifactMarkdownPanel: () => <div data-testid="markdown-panel-mock" />,
}))
vi.mock('@/components/library/shared/ingestion-detail-panel', () => ({
  IngestionDetailPanel: () => <div data-testid="ingestion-detail-mock" />,
}))
vi.mock('@/components/library/shared/ingestion-data-context', () => ({
  IngestionDataProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/library/flow/pipeline-sheet', () => ({
  PipelineSheet: () => <div data-testid="pipeline-sheet-mock" />,
}))
vi.mock('@/components/library/file-preview/transcript-toolbar-actions', () => ({
  TranscriptToolbarActions: () => <div data-testid="transcript-toolbar-mock" />,
}))
vi.mock('@/components/library/file-preview/job-report-tab-with-shadow-twin', () => ({
  JobReportTabWithShadowTwin: () => <div data-testid="job-report-mock" />,
}))

import { VideoView } from '@/components/library/file-preview/views/video-view'

function makeVideoFile(): StorageItem {
  return {
    id: 'video-1',
    parentId: 'root',
    type: 'file',
    metadata: {
      name: 'aufnahme.mp4',
      size: 8765,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'video/mp4',
    },
  }
}

function makeProvider(): StorageProvider {
  return {
    id: 'lib-1',
    name: 'Test',
  } as unknown as StorageProvider
}

function makeBaseProps(overrides: Partial<PreviewViewProps> = {}): PreviewViewProps {
  const item = makeVideoFile()
  return {
    item,
    provider: makeProvider(),
    activeLibraryId: 'lib-1',
    activeLibrary: undefined,
    fileType: 'video',
    kind: 'video',
    infoTab: 'original' as PreviewInfoTab,
    setInfoTab: vi.fn(),
    shadowTwinState: undefined,
    storySteps: [],
    transcript: { transcriptItem: null, isLoading: false, error: null } as PreviewViewProps['transcript'],
    displayTranscriptItem: null,
    transcriptHeaderExtra: null,
    transformItem: null,
    transformError: null,
    transformHeaderExtra: null,
    hasActiveJob: false,
    currentJobInfo: undefined,
    isRunningPipeline: false,
    openPipelineForPhase: vi.fn(),
    isReviewMode: false,
    handleReviewModeToggle: vi.fn(),
    isSplittingPages: false,
    setIsSplittingPages: vi.fn(),
    isPipelineOpen: false,
    setIsPipelineOpen: vi.fn(),
    effectiveTargetLanguage: 'de',
    setTargetLanguage: vi.fn(),
    sourceLanguage: 'auto',
    setSourceLanguage: vi.fn(),
    templateName: '',
    setTemplateName: vi.fn(),
    templates: [],
    isLoadingTemplates: false,
    llmModel: '',
    setLlmModel: vi.fn(),
    llmModels: [],
    isLoadingLlmModels: false,
    runPipeline: vi.fn().mockResolvedValue(undefined),
    pipelineDefaultSteps: undefined,
    pipelineDefaultForce: false,
    savedCustomHint: '',
    ...overrides,
  }
}

describe('VideoView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('zeigt einen Hinweis, wenn provider=null', () => {
    render(<VideoView {...makeBaseProps({ provider: null })} />)
    expect(screen.getByText(/Kein Provider verfuegbar/i)).toBeTruthy()
  })

  it('rendert alle 5 Tab-Trigger', () => {
    render(<VideoView {...makeBaseProps()} />)
    expect(screen.getByText('Original')).toBeTruthy()
    expect(screen.getByText('Transkript')).toBeTruthy()
    expect(screen.getByText('Transformation')).toBeTruthy()
    expect(screen.getByText('Story')).toBeTruthy()
    expect(screen.getByText('Uebersicht')).toBeTruthy()
  })

  it('rendert die SourceAndTranscriptPane (Source-Pane-Mock) im Original-Tab', () => {
    render(<VideoView {...makeBaseProps({ infoTab: 'original' })} />)
    expect(screen.getByTestId('source-pane-mock')).toBeTruthy()
  })

  it('zeigt JobProgressBar, wenn hasActiveJob=true und currentJobInfo vorhanden', () => {
    render(
      <VideoView
        {...makeBaseProps({
          hasActiveJob: true,
          currentJobInfo: { status: 'running', progress: 17 },
        })}
      />
    )
    expect(screen.getByText('17%')).toBeTruthy()
  })
})
