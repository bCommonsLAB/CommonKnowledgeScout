// @vitest-environment jsdom

/**
 * Characterization Tests fuer useImageGeneration-Hook
 * (Welle 3-II-Hooks-d, Schritt 2/3 — Sicherheitsnetz fuer Bild-Generierung).
 *
 * Fixiert das Hook-Verhalten:
 * - Initial-State (kein Bild, nicht generierend)
 * - generate(): API-Call, isGenerating-Flag, Multi-Variant-Mode
 * - selectImage(): Base64 → File-Konvertierung, onGenerated-Callback
 * - resetGeneration(): leert Bilder + Auswahl
 *
 * fetch wird gemockt — keine echten API-Calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock toast — wir testen nicht UI
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock UILogger — kein Logging-Output in Tests
vi.mock('@/lib/debug/logger', () => ({
  UILogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { useImageGeneration } from '@/hooks/library/cover-image-generator-dialog/use-image-generation'

describe('useImageGeneration', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let originalFetch: typeof globalThis.fetch
  let onGeneratedMock: ReturnType<typeof vi.fn>
  let onCloseMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
    onGeneratedMock = vi.fn().mockResolvedValue(undefined)
    onCloseMock = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  function makeArgs() {
    return { onGenerated: onGeneratedMock, onClose: onCloseMock }
  }

  it('liefert Initial-State (kein Bild, nicht generierend)', () => {
    const { result } = renderHook(() => useImageGeneration(makeArgs()))
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.generatedImages).toEqual([])
    expect(result.current.selectedImageIndex).toBeNull()
  })

  it('generate(): leerer Prompt zeigt Fehler-Toast und macht keinen API-Call', async () => {
    const { result } = renderHook(() => useImageGeneration(makeArgs()))

    await act(async () => {
      await result.current.generate('', '1024x1024', 'standard')
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.isGenerating).toBe(false)
  })

  it('generate(4): API-Call mit n=4 + seeds, 4 Bilder werden gesetzt', async () => {
    const mockImages = [
      { image_base64: 'data:image/png;base64,AAA1', image_format: 'png', size: '1024x1024' },
      { image_base64: 'data:image/png;base64,AAA2', image_format: 'png', size: '1024x1024' },
      { image_base64: 'data:image/png;base64,AAA3', image_format: 'png', size: '1024x1024' },
      { image_base64: 'data:image/png;base64,AAA4', image_format: 'png', size: '1024x1024' },
    ]
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ images: mockImages }),
    })

    const { result } = renderHook(() => useImageGeneration(makeArgs()))

    await act(async () => {
      await result.current.generate('Ein Sonnenuntergang', '1024x1024', 'standard', 4)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.n).toBe(4)
    expect(body.seeds).toEqual([101, 102, 103, 104])
    expect(body.useCache).toBe(false)
    expect(body.prompt).toBe('Ein Sonnenuntergang')
    expect(body.size).toBe('1024x1024')
    expect(body.quality).toBe('standard')

    expect(result.current.generatedImages.length).toBe(4)
    expect(result.current.isGenerating).toBe(false)
  })

  it('generate(1): API-Call mit n=1 + useCache=true', async () => {
    const mockImage = { image_base64: 'data:image/png;base64,SINGLE', image_format: 'png', size: '1024x1024' }
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ image_base64: mockImage.image_base64, image_format: 'png', size: '1024x1024' }),
    })

    const { result } = renderHook(() => useImageGeneration(makeArgs()))

    await act(async () => {
      await result.current.generate('Test', '1024x1024', 'standard', 1)
    })

    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.n).toBe(1)
    expect(body.useCache).toBe(true)

    expect(result.current.generatedImages.length).toBe(1)
    expect(result.current.generatedImages[0].image_base64).toBe(mockImage.image_base64)
  })

  it('generate(): HTTP-Fehler setzt keine Bilder', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ error: 'Bildgenerierung fehlgeschlagen' }),
    })

    const { result } = renderHook(() => useImageGeneration(makeArgs()))

    await act(async () => {
      await result.current.generate('Test', '1024x1024', 'standard')
    })

    expect(result.current.generatedImages).toEqual([])
    expect(result.current.isGenerating).toBe(false)
  })

  it('selectImage(): Base64 -> File, onGenerated wird mit File aufgerufen', async () => {
    // Erst mal generieren
    const mockImages = [
      { image_base64: 'data:image/png;base64,AAA1', image_format: 'png', size: '1024x1024' },
    ]
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ images: mockImages }),
    })

    const { result } = renderHook(() => useImageGeneration(makeArgs()))

    await act(async () => {
      await result.current.generate('Test', '1024x1024', 'standard', 1)
    })

    expect(result.current.generatedImages.length).toBe(1)

    // Bild auswaehlen
    await act(async () => {
      await result.current.selectImage(0)
    })

    expect(onGeneratedMock).toHaveBeenCalledTimes(1)
    const file = onGeneratedMock.mock.calls[0][0] as File
    expect(file).toBeInstanceOf(File)
    expect(file.name).toMatch(/^cover_generated_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/)
    expect(file.type).toBe('image/png')

    // onClose wurde aufgerufen
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('selectImage(): ungueltiger Index macht nichts', async () => {
    const { result } = renderHook(() => useImageGeneration(makeArgs()))

    // Keine Bilder vorhanden, Index ungueltig
    await act(async () => {
      await result.current.selectImage(0)
    })

    expect(onGeneratedMock).not.toHaveBeenCalled()
    expect(onCloseMock).not.toHaveBeenCalled()
  })

  it('resetGeneration() leert Bilder + Auswahl', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        images: [{ image_base64: 'AAA', image_format: 'png', size: '1024x1024' }],
      }),
    })

    const { result } = renderHook(() => useImageGeneration(makeArgs()))

    await act(async () => {
      await result.current.generate('Test', '1024x1024', 'standard', 1)
    })

    expect(result.current.generatedImages.length).toBe(1)

    act(() => {
      result.current.resetGeneration()
    })

    expect(result.current.generatedImages).toEqual([])
    expect(result.current.selectedImageIndex).toBeNull()
  })

  it('isGenerating-Flag waehrend laufendem fetch true', async () => {
    let resolveFetch: ((value: unknown) => void) | null = null
    fetchMock.mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve }),
    )

    const { result } = renderHook(() => useImageGeneration(makeArgs()))

    let generatePromise: Promise<void> | null = null
    act(() => {
      generatePromise = result.current.generate('Test', '1024x1024', 'standard', 1)
    })

    await waitFor(() => expect(result.current.isGenerating).toBe(true))

    await act(async () => {
      resolveFetch?.({
        ok: true,
        status: 200,
        json: async () => ({ images: [] }),
      })
      await generatePromise
    })

    expect(result.current.isGenerating).toBe(false)
  })
})
