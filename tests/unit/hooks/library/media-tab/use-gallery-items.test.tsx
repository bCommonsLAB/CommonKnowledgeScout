// @vitest-environment jsdom

/**
 * Characterization Tests fuer useGalleryItems-Hook
 * (Welle 3-III-a, Schritt 1/4 + Sicherheitsnetz).
 *
 * Fixiert das Render-Verhalten des Hooks:
 * - Initial-State (loading=true, leere Listen)
 * - Erfolgreiche Aggregation → galleryItems gesetzt
 * - API-Fehler → aggregatedError gesetzt, leere Listen
 * - Assignment-Filter beeinflusst galleryItems
 * - previewUrlByFileName wird korrekt aufgebaut
 *
 * fetch wird gemockt — keine echten API-Calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGalleryItems, type UseGalleryItemsArgs } from '@/hooks/library/media-tab/use-gallery-items'
import type { ViewTypeMediaConfig } from '@/lib/detail-view-types/registry'

const minimalMediaConfig: ViewTypeMediaConfig = {
  // Alle Felder optional — Type-Cast OK fuer Test-Args
} as ViewTypeMediaConfig

function makeArgs(overrides: Partial<UseGalleryItemsArgs> = {}): UseGalleryItemsArgs {
  return {
    libraryId: 'lib-1',
    fileId: 'file-1',
    useMultiSourceAggregation: false,
    compositeSourceNames: [],
    frontmatterMeta: null,
    mediaConfig: minimalMediaConfig,
    activeAssignment: null,
    ...overrides,
  }
}

describe('useGalleryItems', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('liefert Initial-State (Loading=true, leere Listen)', () => {
    // fetch resolved nicht — Hook bleibt im loading-State.
    fetchMock.mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useGalleryItems(makeArgs()))

    expect(result.current.galleryItems).toEqual([])
    expect(result.current.aggregatedError).toBeNull()
    expect(result.current.previewUrlByFileName.size).toBe(0)
  })

  it('liefert galleryItems aus erfolgreicher API-Antwort', async () => {
    const mockResponse = {
      files: [
        { id: 'sib-1', name: 'photo.jpg', mediaKind: 'image', size: 1234 },
      ],
      fragmentGalleryItems: [
        {
          key: 'frag-1',
          displayName: 'img-0.jpeg',
          fragmentSourceId: 'pdf-1',
          mediaKind: 'image',
          previewUrl: 'https://example.com/img-0.jpeg',
          sourceFileName: 'doku.pdf',
        },
      ],
    }
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useGalleryItems(makeArgs()))

    await waitFor(() => expect(result.current.galleryItems.length).toBeGreaterThan(0))

    expect(result.current.galleryItems.length).toBe(2)
    expect(result.current.aggregatedError).toBeNull()
    // Fragment-Item kommt zuerst (so wie im Original-Code aufgebaut)
    expect(result.current.galleryItems[0].source).toBe('fragment')
    expect(result.current.galleryItems[1].source).toBe('sibling')
  })

  it('liefert aggregatedError bei HTTP-Fehler', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server-Fehler' }),
    })

    const { result } = renderHook(() => useGalleryItems(makeArgs()))

    await waitFor(() => expect(result.current.aggregatedError).toBe('Server-Fehler'))
    expect(result.current.galleryItems).toEqual([])
  })

  it('liefert aggregatedError bei Network-Exception', async () => {
    fetchMock.mockRejectedValue(new Error('Network down'))

    const { result } = renderHook(() => useGalleryItems(makeArgs()))

    await waitFor(() => expect(result.current.aggregatedError).toBe('Network down'))
    expect(result.current.galleryItems).toEqual([])
  })

  it('Assignment-Filter "url" zeigt nur link-Items', async () => {
    const mockResponse = {
      files: [
        { id: 'sib-1', name: 'photo.jpg', mediaKind: 'image' },
        { id: 'sib-2', name: 'page.url', mediaKind: 'link' },
      ],
      fragmentGalleryItems: [],
    }
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useGalleryItems(
      makeArgs({ activeAssignment: { fieldKey: 'url' } }),
    ))

    await waitFor(() => expect(result.current.galleryItems.length).toBe(1))

    expect(result.current.galleryItems[0].mediaKind).toBe('link')
  })

  it('previewUrlByFileName mappt Sibling-Bilder auf Storage-API-URL', async () => {
    const mockResponse = {
      files: [
        { id: 'sib-1', name: 'photo.jpg', mediaKind: 'image' },
      ],
      fragmentGalleryItems: [],
    }
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useGalleryItems(makeArgs()))

    await waitFor(() => expect(result.current.previewUrlByFileName.size).toBeGreaterThan(0))

    expect(result.current.previewUrlByFileName.get('photo.jpg')).toBeDefined()
    expect(result.current.previewUrlByFileName.get('photo.jpg')).toContain('/api/storage/streaming-url')
  })

  it('liefert leere Listen bei leeren libraryId/fileId', () => {
    fetchMock.mockResolvedValue({} as Response)

    const { result } = renderHook(() =>
      useGalleryItems(makeArgs({ libraryId: '', fileId: '' })),
    )

    // Effect sollte gar nicht laufen (early return) — fetch wird nicht
    // aufgerufen.
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.galleryItems).toEqual([])
  })
})
