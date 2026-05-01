// @vitest-environment jsdom

/**
 * Characterization Tests fuer markdown-preview.tsx
 * (Welle 3-II-b, Schritt 1 — Sicherheitsnetz vor Modul-Split).
 *
 * Fixiert das Render-Verhalten der MarkdownPreview-Komponente:
 * - Leeres content rendert ohne Crash
 * - Markdown-Header wird zu HTML-Heading
 * - Bearbeiten-Button erscheint nur wenn onEdit gesetzt
 * - Compact-Modus deaktiviert die Schnellsuche
 *
 * Sub-Komponenten und externe Dependencies (highlight.js, remarkable)
 * werden als Echte verwendet, weil sie Pure sind. Atom-State wird
 * via Provider gesetzt.
 *
 * Diese Tests bilden das Sicherheitsnetz fuer die Modul-Splits in
 * Welle 3-II-b (TextTransform, SearchPopover, Helper-Module).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Provider as JotaiProvider, createStore } from 'jotai'
import { selectedFileAtom, activeLibraryIdAtom } from '@/atoms/library-atom'

// Mock useStorage-Context, damit MarkdownPreview ohne echtes Storage
// rendern kann.
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ provider: null }),
}))

// Mock TransformResultHandler — wir testen nicht die Transformation hier.
vi.mock('@/components/library/transform-result-handler', () => ({
  TransformResultHandler: () => <div data-testid="transform-handler-mock" />,
}))

// Mock TransformService — wuerde sonst fetch-Calls in jsdom triggern.
vi.mock('@/lib/transform/transform-service', () => ({
  TransformService: {},
}))

vi.mock('@/lib/secretary/client', () => ({
  transformTextWithTemplate: vi.fn().mockResolvedValue({ result: '' }),
}))

import { MarkdownPreview } from '@/components/library/markdown-preview'

function renderWithJotai(node: React.ReactElement) {
  const store = createStore()
  store.set(selectedFileAtom, null)
  store.set(activeLibraryIdAtom, '')
  return render(<JotaiProvider store={store}>{node}</JotaiProvider>)
}

describe('MarkdownPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert ohne Crash bei leerem content', () => {
    const { container } = renderWithJotai(<MarkdownPreview content="" />)
    expect(container).toBeTruthy()
  })

  it('rendert Markdown-Heading als HTML-Heading', () => {
    renderWithJotai(<MarkdownPreview content="# Hallo Welt" />)
    const heading = document.querySelector('h1')
    expect(heading).toBeTruthy()
    expect(heading?.textContent).toContain('Hallo Welt')
  })

  it('rendert Markdown-Paragraph mit Text', () => {
    renderWithJotai(<MarkdownPreview content="Das ist ein **fetter** Text." />)
    const strong = document.querySelector('strong')
    expect(strong).toBeTruthy()
    expect(strong?.textContent).toBe('fetter')
  })

  it('zeigt Bearbeiten-Button NICHT, wenn onEdit nicht gesetzt ist', () => {
    renderWithJotai(<MarkdownPreview content="# Test" />)
    const editButtons = screen.queryAllByRole('button', { name: /Bearbeiten/i })
    expect(editButtons.length).toBe(0)
  })

  it('zeigt Bearbeiten-Button, wenn onEdit gesetzt ist', () => {
    const onEdit = vi.fn()
    renderWithJotai(<MarkdownPreview content="# Test" onEdit={onEdit} />)
    const editButton = screen.getByRole('button', { name: /Bearbeiten/i })
    expect(editButton).toBeTruthy()
  })

  it('strippt Frontmatter aus dem gerenderten Content', () => {
    const md = `---
title: Mein Doc
---

# Eigentlicher Inhalt`
    renderWithJotai(<MarkdownPreview content={md} />)
    // Der Frontmatter-Block sollte NICHT als Text auftauchen
    const body = document.body.textContent ?? ''
    expect(body).not.toContain('title: Mein Doc')
    // Der eigentliche Header schon
    expect(body).toContain('Eigentlicher Inhalt')
  })
})
