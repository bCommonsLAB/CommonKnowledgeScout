// @vitest-environment jsdom

/**
 * Characterization Tests fuer useFrontmatterEditor-Hook
 * (Welle 3-III-b, Schritt 3/4 — Sicherheitsnetz fuer Inline-Editing).
 *
 * Fixiert das Render-Verhalten:
 * - Initial-State (kein Edit-Feld, leerer Wert, nicht speichernd)
 * - setEditingField + setEditingValue setzen den State
 * - saveMetaField setzt isSaving=true → false und resetet das Edit-Feld
 *
 * Persistenz (Mongo/Filesystem) wird gemockt — wir testen nur die
 * State-Maschine.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mocks fuer Persistenz-Pfade (Mongo + Filesystem werden NICHT real
// aufgerufen).
const updateShadowTwinMarkdownMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/shadow-twin/shadow-twin-mongo-client', () => ({
  fetchShadowTwinMarkdown: vi.fn(),
  updateShadowTwinMarkdown: (libraryId: string, parts: unknown, content: string) =>
    updateShadowTwinMarkdownMock(libraryId, parts, content),
}))

// Mock parseSecretaryMarkdownStrict — liefert vereinfachtes Meta-Object
vi.mock('@/lib/secretary/response-parser', () => ({
  parseSecretaryMarkdownStrict: (content: string) => ({
    meta: { existing: 'value', body: content.length > 0 ? 'present' : 'empty' },
    errors: [],
  }),
}))

// Mock toast — wir testen nicht UI
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock isMongoShadowTwinId / parseMongoShadowTwinId
vi.mock('@/lib/shadow-twin/mongo-shadow-twin-id', () => ({
  isMongoShadowTwinId: (id: string) => id?.startsWith('mongo:'),
  parseMongoShadowTwinId: (id: string) => ({ raw: id }),
}))

import { useFrontmatterEditor } from '@/hooks/library/job-report-tab/use-frontmatter-editor'

function makeArgs(overrides: Partial<Parameters<typeof useFrontmatterEditor>[0]> = {}) {
  return {
    libraryId: 'lib-1',
    effectiveMdId: 'mongo:abc',
    fullContent: '---\nexisting: value\n---\n\nBody',
    provider: null,
    stripFrontmatter: (content: string) => content.replace(/^---\n[\s\S]*?\n---\n*/, ''),
    onContentUpdated: vi.fn(),
    ...overrides,
  }
}

describe('useFrontmatterEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('liefert Initial-State (kein Edit-Feld)', () => {
    const { result } = renderHook(() => useFrontmatterEditor(makeArgs()))
    expect(result.current.editingField).toBeNull()
    expect(result.current.editingValue).toBe('')
    expect(result.current.isSaving).toBe(false)
  })

  it('setEditingField + setEditingValue aktualisieren State', () => {
    const { result } = renderHook(() => useFrontmatterEditor(makeArgs()))

    act(() => {
      result.current.setEditingField('title')
      result.current.setEditingValue('Neuer Titel')
    })

    expect(result.current.editingField).toBe('title')
    expect(result.current.editingValue).toBe('Neuer Titel')
  })

  it('saveMetaField persistiert nach MongoDB und resetet Edit-State', async () => {
    const onContentUpdated = vi.fn()
    const { result } = renderHook(() => useFrontmatterEditor(makeArgs({ onContentUpdated })))

    act(() => {
      result.current.setEditingField('title')
      result.current.setEditingValue('Neuer Titel')
    })

    await act(async () => {
      await result.current.saveMetaField('title', 'Neuer Titel')
    })

    // updateShadowTwinMarkdown wurde aufgerufen
    expect(updateShadowTwinMarkdownMock).toHaveBeenCalledTimes(1)
    expect(updateShadowTwinMarkdownMock.mock.calls[0][0]).toBe('lib-1')

    // onContentUpdated wurde mit neuem Content gerufen
    expect(onContentUpdated).toHaveBeenCalledTimes(1)
    const [newContent, meta, errors] = onContentUpdated.mock.calls[0]
    expect(newContent).toContain('title: Neuer Titel')
    expect(meta).toBeDefined()
    expect(errors).toEqual([])

    // Edit-State zurueckgesetzt
    expect(result.current.editingField).toBeNull()
    expect(result.current.editingValue).toBe('')
    expect(result.current.isSaving).toBe(false)
  })

  it('saveMetaField mit JSON-Array-Wert: Wert wird geparst', async () => {
    const onContentUpdated = vi.fn()
    const { result } = renderHook(() => useFrontmatterEditor(makeArgs({ onContentUpdated })))

    await act(async () => {
      await result.current.saveMetaField('tags', '["a","b","c"]')
    })

    const newContent = onContentUpdated.mock.calls[0][0]
    // Array-Form (nicht als String) im Frontmatter
    expect(newContent).toContain('tags: ["a","b","c"]')
  })

  it('saveMetaField gibt early return bei fehlendem effectiveMdId', async () => {
    const onContentUpdated = vi.fn()
    const { result } = renderHook(() =>
      useFrontmatterEditor(makeArgs({ effectiveMdId: null, onContentUpdated })),
    )

    await act(async () => {
      await result.current.saveMetaField('title', 'X')
    })

    expect(updateShadowTwinMarkdownMock).not.toHaveBeenCalled()
    expect(onContentUpdated).not.toHaveBeenCalled()
  })

  it('saveMetaField setzt isSaving waehrend des Saves auf true', async () => {
    // Wir simulieren einen langsamen Save, damit waitFor den isSaving=true
    // Zustand zwischen Start und Ende sehen kann.
    let resolveUpdate: (() => void) | null = null
    updateShadowTwinMarkdownMock.mockImplementation(
      () => new Promise<void>((resolve) => { resolveUpdate = resolve }),
    )

    const { result } = renderHook(() => useFrontmatterEditor(makeArgs()))

    // Start des Saves (await NICHT — sonst blockiert isSaving-Test)
    let savePromise: Promise<void> | null = null
    act(() => {
      savePromise = result.current.saveMetaField('title', 'X')
    })

    // Warten bis isSaving=true
    await waitFor(() => expect(result.current.isSaving).toBe(true))

    // Save-Promise abschliessen
    await act(async () => {
      resolveUpdate?.()
      await savePromise
    })

    expect(result.current.isSaving).toBe(false)
  })

  it('exposed setIsSaving fuer parallele Save-Pfade', () => {
    const { result } = renderHook(() => useFrontmatterEditor(makeArgs()))

    expect(result.current.isSaving).toBe(false)
    act(() => {
      result.current.setIsSaving(true)
    })
    expect(result.current.isSaving).toBe(true)
    act(() => {
      result.current.setIsSaving(false)
    })
    expect(result.current.isSaving).toBe(false)
  })
})
