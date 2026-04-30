// @vitest-environment jsdom

/**
 * Characterization Tests fuer file-preview/views/presentation-view.tsx
 * (Welle 3-II-a Phase 2d, Schritt 3/4 — Sicherheitsnetz fuer
 * Praesentations-Wrapper).
 *
 * PresentationView ist eine Mini-Komponente, die nur an DocumentPreview
 * weiterreicht. Test stellt sicher, dass die Props korrekt durchgereicht
 * werden.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { PreviewViewProps, PreviewInfoTab } from '@/components/library/file-preview/views/view-props'

const documentPreviewSpy = vi.fn()

vi.mock('@/components/library/document-preview', () => ({
  DocumentPreview: (props: Record<string, unknown>) => {
    documentPreviewSpy(props)
    return <div data-testid="document-preview-mock" />
  },
}))

import { PresentationView } from '@/components/library/file-preview/views/presentation-view'

function makePresentationFile(): StorageItem {
  return {
    id: 'pres-1',
    parentId: 'root',
    type: 'file',
    metadata: {
      name: 'slides.pptx',
      size: 9999,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
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
  const item = makePresentationFile()
  return {
    item,
    provider: makeProvider(),
    activeLibraryId: 'lib-1',
    activeLibrary: undefined,
    fileType: 'presentation',
    kind: 'presentation',
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

describe('PresentationView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentPreviewSpy.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert DocumentPreview', () => {
    render(<PresentationView {...makeBaseProps()} />)
    expect(screen.getByTestId('document-preview-mock')).toBeTruthy()
  })

  it('reicht provider, activeLibraryId und onRefreshFolder durch', () => {
    const onRefreshFolder = vi.fn()
    const provider = makeProvider()
    render(
      <PresentationView
        {...makeBaseProps({ provider, onRefreshFolder })}
      />,
    )
    expect(documentPreviewSpy).toHaveBeenCalledTimes(1)
    const callArgs = documentPreviewSpy.mock.calls[0][0]
    expect(callArgs.provider).toBe(provider)
    expect(callArgs.activeLibraryId).toBe('lib-1')
    expect(callArgs.onRefreshFolder).toBe(onRefreshFolder)
  })
})
