// @vitest-environment jsdom

/**
 * Characterization Tests fuer file-preview/views/default-view.tsx
 * (Welle 3-II-a Phase 2b, Schritt 3 — Sicherheitsnetz fuer Fallback-Pfad).
 *
 * Fixiert das Render-Verhalten:
 * - Es wird ein "Keine Vorschau verfuegbar"-Hinweis gerendert (ist
 *   die einzige sichtbare UI dieser View).
 * - Das PipelineSheet wird trotzdem mitgerendert, damit der User eine
 *   Pipeline starten kann.
 *
 * Sub-Komponenten (PipelineSheet) werden gemockt — wir testen nur die
 * Default-View-Schale.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { StorageItem } from '@/lib/storage/types'
import type { PreviewViewProps, PreviewInfoTab } from '@/components/library/file-preview/views/view-props'

vi.mock('@/components/library/flow/pipeline-sheet', () => ({
  PipelineSheet: () => <div data-testid="pipeline-sheet-mock" />,
}))

import { DefaultView } from '@/components/library/file-preview/views/default-view'

function makeUnknownFile(): StorageItem {
  return {
    id: 'unknown-1',
    parentId: 'root',
    type: 'file',
    metadata: {
      name: 'datei.xyz',
      size: 100,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'application/octet-stream',
    },
  }
}

function makeBaseProps(overrides: Partial<PreviewViewProps> = {}): PreviewViewProps {
  const item = makeUnknownFile()
  return {
    item,
    provider: null,
    activeLibraryId: 'lib-1',
    activeLibrary: undefined,
    fileType: 'unknown',
    kind: 'unknown',
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

describe('DefaultView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert den "Keine Vorschau verfuegbar"-Hinweis', () => {
    render(<DefaultView {...makeBaseProps()} />)
    expect(screen.getByText(/Keine Vorschau verfuegbar/i)).toBeTruthy()
  })

  it('rendert das PipelineSheet trotzdem (User kann Pipeline starten)', () => {
    render(<DefaultView {...makeBaseProps()} />)
    expect(screen.getByTestId('pipeline-sheet-mock')).toBeTruthy()
  })

  it('rendert auch ohne provider (provider=null wird einfach durchgereicht)', () => {
    render(<DefaultView {...makeBaseProps({ provider: null })} />)
    expect(screen.getByText(/Keine Vorschau verfuegbar/i)).toBeTruthy()
    expect(screen.getByTestId('pipeline-sheet-mock')).toBeTruthy()
  })
})
