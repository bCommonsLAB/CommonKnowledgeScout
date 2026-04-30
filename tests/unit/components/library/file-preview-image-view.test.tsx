// @vitest-environment jsdom

/**
 * Characterization Tests fuer file-preview/views/image-view.tsx
 * (Welle 3-II-a Phase 2a, Schritt 3).
 *
 * Fixiert das Render-Verhalten:
 * - Bei provider=null wird ein "Kein Provider"-Hinweis gerendert.
 * - Mit gueltigen Props rendert die View die 4 Tab-Trigger
 *   (Original, Analyse, Story, Uebersicht — KEIN Transcript).
 * - Job-Progress-Bar erscheint, wenn hasActiveJob=true.
 *
 * Sub-Komponenten werden gemockt.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { PreviewViewProps, PreviewInfoTab } from '@/components/library/file-preview/views/view-props'

vi.mock('@/components/library/image-preview', () => ({
  ImagePreview: () => <div data-testid="image-preview-mock" />,
}))
vi.mock('@/components/library/shared/artifact-info-panel', () => ({
  ArtifactInfoPanel: () => <div data-testid="info-panel-mock" />,
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
vi.mock('@/components/library/file-preview/job-report-tab-with-shadow-twin', () => ({
  JobReportTabWithShadowTwin: () => <div data-testid="job-report-mock" />,
}))

import { ImageView } from '@/components/library/file-preview/views/image-view'

function makeImageFile(): StorageItem {
  return {
    id: 'img-1',
    parentId: 'root',
    type: 'file',
    metadata: {
      name: 'foto.jpg',
      size: 5678,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'image/jpeg',
    },
  }
}

function makeProvider(): StorageProvider {
  return { id: 'lib-1', name: 'Test' } as unknown as StorageProvider
}

function makeBaseProps(overrides: Partial<PreviewViewProps> = {}): PreviewViewProps {
  return {
    item: makeImageFile(),
    provider: makeProvider(),
    activeLibraryId: 'lib-1',
    activeLibrary: undefined,
    fileType: 'image',
    kind: 'image',
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

describe('ImageView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('zeigt einen Hinweis, wenn provider=null', () => {
    render(
      <Provider store={createStore()}>
        <ImageView {...makeBaseProps({ provider: null })} />
      </Provider>
    )
    expect(screen.getByText(/Kein Provider verfuegbar/i)).toBeTruthy()
  })

  it('rendert nur 4 Tab-Trigger (kein Transcript-Tab)', () => {
    render(
      <Provider store={createStore()}>
        <ImageView {...makeBaseProps()} />
      </Provider>
    )
    expect(screen.getByText('Original')).toBeTruthy()
    expect(screen.getByText('Analyse')).toBeTruthy()
    expect(screen.getByText('Story')).toBeTruthy()
    expect(screen.getByText('Uebersicht')).toBeTruthy()
    // Image-View hat KEINEN Transcript-Tab — Bilder werden nicht transkribiert.
    expect(screen.queryByText('Transkript')).toBeNull()
  })

  it('rendert ImagePreview im Original-Tab', () => {
    render(
      <Provider store={createStore()}>
        <ImageView {...makeBaseProps({ infoTab: 'original' })} />
      </Provider>
    )
    expect(screen.getByTestId('image-preview-mock')).toBeTruthy()
  })

  it('zeigt JobProgressBar bei hasActiveJob=true', () => {
    render(
      <Provider store={createStore()}>
        <ImageView
          {...makeBaseProps({
            hasActiveJob: true,
            currentJobInfo: { status: 'running', progress: 75 },
          })}
        />
      </Provider>
    )
    expect(screen.getByText('75%')).toBeTruthy()
  })
})
