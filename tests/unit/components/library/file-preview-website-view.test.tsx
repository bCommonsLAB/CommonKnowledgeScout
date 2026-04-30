// @vitest-environment jsdom

/**
 * Characterization Tests fuer file-preview/views/website-view.tsx
 * (Welle 3-II-a Phase 2d, Schritt 4/4 — Sicherheitsnetz fuer .url-
 * Detail mit Iframe-Vorschau).
 *
 * Fixiert das Render-Verhalten:
 * - Bei provider=null wird ein "Kein Provider"-Hinweis gerendert.
 * - Mit gueltigen Props rendert die View die 5 Tab-Trigger.
 * - URL aus dem .url-Format-Inhalt wird im Iframe + als Link angezeigt.
 * - Fehlende URL zeigt Hinweis-Text.
 * - Job-Progress-Bar erscheint, wenn hasActiveJob=true.
 *
 * Sub-Komponenten werden gemockt — wir testen nur die Website-View-Schale.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { PreviewViewProps, PreviewInfoTab } from '@/components/library/file-preview/views/view-props'

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
vi.mock('@/components/library/file-preview/review-split', () => ({
  ReviewTranscriptSplit: () => <div data-testid="review-split-mock" />,
  WebsiteReviewOriginalIframe: () => <div data-testid="website-iframe-mock" />,
}))

import { WebsiteView } from '@/components/library/file-preview/views/website-view'

function makeUrlFile(): StorageItem {
  return {
    id: 'url-1',
    parentId: 'root',
    type: 'file',
    metadata: {
      name: 'meine-seite.url',
      size: 100,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'text/url',
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
  const item = makeUrlFile()
  return {
    item,
    provider: makeProvider(),
    activeLibraryId: 'lib-1',
    activeLibrary: undefined,
    fileType: 'website',
    kind: 'website',
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
    // Website-spezifisch (Phase 2d):
    content: '[InternetShortcut]\nURL=https://example.com/seite',
    ...overrides,
  }
}

describe('WebsiteView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('zeigt einen Hinweis, wenn provider=null', () => {
    render(<WebsiteView {...makeBaseProps({ provider: null })} />)
    expect(screen.getByText(/Kein Provider verfuegbar/i)).toBeTruthy()
  })

  it('rendert alle 5 Tab-Trigger', () => {
    render(<WebsiteView {...makeBaseProps()} />)
    expect(screen.getByText('Original')).toBeTruthy()
    expect(screen.getByText('Transkript')).toBeTruthy()
    expect(screen.getByText('Transformation')).toBeTruthy()
    expect(screen.getByText('Story')).toBeTruthy()
    expect(screen.getByText('Uebersicht')).toBeTruthy()
  })

  it('zeigt die URL aus dem .url-Inhalt im Original-Tab als Link', () => {
    render(<WebsiteView {...makeBaseProps({ infoTab: 'original' })} />)
    const link = screen.getByText('https://example.com/seite')
    expect(link).toBeTruthy()
    expect(link.tagName).toBe('A')
    expect((link as HTMLAnchorElement).href).toBe('https://example.com/seite')
  })

  it('zeigt Hinweis "Keine gueltige URL", wenn content keine URL enthaelt', () => {
    render(<WebsiteView {...makeBaseProps({ infoTab: 'original', content: 'kein url-format' })} />)
    expect(screen.getByText(/Keine gueltige URL gefunden/i)).toBeTruthy()
  })

  it('zeigt JobProgressBar, wenn hasActiveJob=true und currentJobInfo vorhanden', () => {
    render(
      <WebsiteView
        {...makeBaseProps({
          hasActiveJob: true,
          currentJobInfo: { status: 'running', progress: 67 },
        })}
      />
    )
    expect(screen.getByText('67%')).toBeTruthy()
  })
})
