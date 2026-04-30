// @vitest-environment jsdom

/**
 * Characterization Tests fuer file-preview/views/markdown-view.tsx
 * (Welle 3-II-a Phase 2d, Schritt 2/4 — Sicherheitsnetz fuer
 * Markdown-Detail mit Edit-Dialog).
 *
 * Fixiert das Render-Verhalten:
 * - Bei provider=null wird ein "Kein Provider"-Hinweis gerendert.
 * - Mit gueltigen Props rendert die View die 5 Tab-Trigger.
 * - Edit-Button im Original-Tab triggert setIsEditOpen(true).
 * - Job-Progress-Bar erscheint, wenn hasActiveJob=true und currentJobInfo
 *   vorhanden.
 *
 * Sub-Komponenten werden gemockt — wir testen nur die Markdown-View-Schale.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { PreviewViewProps, PreviewInfoTab } from '@/components/library/file-preview/views/view-props'

vi.mock('@/components/library/markdown-preview', () => ({
  MarkdownPreview: () => <div data-testid="markdown-preview-mock" />,
  // Re-Export, damit der TS-Type-Import in view-props.ts funktioniert.
  // Wir definieren ihn als unknown, weil die Tests nur den Render-Pfad
  // testen, nicht die genaue Form.
}))
vi.mock('@/components/library/markdown-metadata', () => ({
  extractFrontmatter: () => null,
}))
vi.mock('@/components/library/shared/artifact-info-panel', () => ({
  ArtifactInfoPanel: () => <div data-testid="info-panel-mock" />,
}))
vi.mock('@/components/library/shared/artifact-markdown-panel', () => ({
  ArtifactMarkdownPanel: () => <div data-testid="markdown-panel-mock" />,
}))
vi.mock('@/components/library/shared/artifact-edit-dialog', () => ({
  ArtifactEditDialog: () => <div data-testid="edit-dialog-mock" />,
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

import { MarkdownView } from '@/components/library/file-preview/views/markdown-view'

function makeMarkdownFile(): StorageItem {
  return {
    id: 'md-1',
    parentId: 'root',
    type: 'file',
    metadata: {
      name: 'notiz.md',
      size: 555,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'text/markdown',
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
  const item = makeMarkdownFile()
  return {
    item,
    provider: makeProvider(),
    activeLibraryId: 'lib-1',
    activeLibrary: undefined,
    fileType: 'markdown',
    kind: 'markdown',
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
    // Markdown-spezifisch (Phase 2d):
    content: '# Test Inhalt\n\nHallo Welt.',
    currentFolderId: 'root',
    compositeWikiPreview: null,
    isEditOpen: false,
    setIsEditOpen: vi.fn(),
    contentCache: { current: new Map() },
    onContentUpdated: vi.fn(),
    setSelectedFile: vi.fn(),
    ...overrides,
  }
}

describe('MarkdownView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('zeigt einen Hinweis, wenn provider=null', () => {
    render(<MarkdownView {...makeBaseProps({ provider: null })} />)
    expect(screen.getByText(/Kein Provider verfuegbar/i)).toBeTruthy()
  })

  it('rendert alle 5 Tab-Trigger', () => {
    render(<MarkdownView {...makeBaseProps()} />)
    expect(screen.getByText('Original')).toBeTruthy()
    expect(screen.getByText('Transkript')).toBeTruthy()
    expect(screen.getByText('Transformation')).toBeTruthy()
    expect(screen.getByText('Story')).toBeTruthy()
    expect(screen.getByText('Uebersicht')).toBeTruthy()
  })

  it('rendert MarkdownPreview im Original-Tab', () => {
    render(<MarkdownView {...makeBaseProps({ infoTab: 'original' })} />)
    expect(screen.getByTestId('markdown-preview-mock')).toBeTruthy()
  })

  it('Klick auf "Bearbeiten"-Button ruft setIsEditOpen(true) auf', () => {
    const setIsEditOpen = vi.fn()
    render(<MarkdownView {...makeBaseProps({ infoTab: 'original', setIsEditOpen })} />)
    const editButton = screen.getByRole('button', { name: /Bearbeiten/i })
    fireEvent.click(editButton)
    expect(setIsEditOpen).toHaveBeenCalledWith(true)
  })

  it('zeigt JobProgressBar, wenn hasActiveJob=true und currentJobInfo vorhanden', () => {
    render(
      <MarkdownView
        {...makeBaseProps({
          hasActiveJob: true,
          currentJobInfo: { status: 'running', progress: 33 },
        })}
      />
    )
    expect(screen.getByText('33%')).toBeTruthy()
  })
})
