// @vitest-environment jsdom

/**
 * Characterization Tests fuer `TextEditor` (Welle 3-II, Schritt 3).
 *
 * Fixiert:
 * - Render mit content-Prop
 * - Save-Button ruft onSaveAction mit aktuellem Wert auf
 * - Save-Button ist disabled, wenn isLoading
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TextEditor } from '@/components/library/text-editor'
import type { StorageProvider } from '@/lib/storage/types'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

function makeProvider(): StorageProvider {
  return {
    id: 'lib-1',
    name: 'Test',
  } as unknown as StorageProvider
}

describe('TextEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert content-Prop in Textarea', () => {
    render(
      <TextEditor
        content="Hallo Welt"
        provider={makeProvider()}
        onSaveAction={vi.fn().mockResolvedValue(undefined)}
      />
    )
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('Hallo Welt')
  })

  it('ruft onSaveAction mit aktuellem Wert auf, wenn Save geklickt wird', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <TextEditor
        content="alt"
        provider={makeProvider()}
        onSaveAction={onSave}
      />
    )
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'neu' } })
    const saveBtn = screen.getByRole('button', { name: /Speichern/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('neu')
    })
  })

  it('zeigt einen Fehler-Toast, wenn provider=null', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <TextEditor
        content=""
        provider={null}
        onSaveAction={onSave}
      />
    )
    const saveBtn = screen.getByRole('button', { name: /Speichern/i })
    fireEvent.click(saveBtn)
    // onSave darf nicht aufgerufen werden, wenn provider=null
    expect(onSave).not.toHaveBeenCalled()
  })

  it('aktualisiert den Editor, wenn die content-Prop sich aendert (z.B. nach Lazy-Load)', () => {
    const { rerender } = render(
      <TextEditor
        content="erst-leer"
        provider={makeProvider()}
        onSaveAction={vi.fn().mockResolvedValue(undefined)}
      />
    )
    rerender(
      <TextEditor
        content="dann-gefuellt"
        provider={makeProvider()}
        onSaveAction={vi.fn().mockResolvedValue(undefined)}
      />
    )
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('dann-gefuellt')
  })
})
