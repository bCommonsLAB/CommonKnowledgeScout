// @vitest-environment jsdom

/**
 * Characterization Tests fuer useResolvedSessionMedia-Hook
 * (Welle 3-III-c, Schritt 2/3 — Sicherheitsnetz fuer Media-Resolution).
 *
 * Fixiert das Render-Verhalten:
 * - attachmentNames + galleryImageNames + coverImageName aus Frontmatter
 * - Absolute http(s)-URLs werden nicht aufgeloest (durchgereicht)
 * - resolvedAttachments + resolvedGalleryImages + resolvedCoverImageUrl
 * - unresolvedAttachmentNames + unresolvedGalleryImageNames
 * - markGalleryUrlAsFailed updated failedGalleryUrls
 *
 * fetch wird gemockt — keine echten API-Calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useResolvedSessionMedia, type UseResolvedSessionMediaArgs } from '@/hooks/library/session-detail/use-resolved-session-media'

function makeArgs(overrides: Partial<UseResolvedSessionMediaArgs> = {}): UseResolvedSessionMediaArgs {
  return {
    libraryId: 'lib-1',
    fileId: 'file-1',
    fileName: 'test.md',
    currentFolderId: 'folder-1',
    provider: null,
    attachmentsUrl: undefined,
    galleryImageUrls: undefined,
    coverImageUrl: undefined,
    getDisplayFileName: (v) => v,
    ...overrides,
  }
}

describe('useResolvedSessionMedia', () => {
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

  it('extrahiert attachmentNames aus Array', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() =>
      useResolvedSessionMedia(makeArgs({ attachmentsUrl: ['a.pdf', 'b.pdf', 'c.pdf'] })),
    )
    expect(result.current.attachmentNames).toEqual(['a.pdf', 'b.pdf', 'c.pdf'])
  })

  it('extrahiert attachmentNames aus String (single value)', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() =>
      useResolvedSessionMedia(makeArgs({ attachmentsUrl: 'single.pdf' })),
    )
    expect(result.current.attachmentNames).toEqual(['single.pdf'])
  })

  it('extrahiert galleryImageNames aus Array', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() =>
      useResolvedSessionMedia(makeArgs({ galleryImageUrls: ['1.jpg', '2.jpg'] })),
    )
    expect(result.current.galleryImageNames).toEqual(['1.jpg', '2.jpg'])
  })

  it('extrahiert coverImageName aus String', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() =>
      useResolvedSessionMedia(makeArgs({ coverImageUrl: 'cover.jpg' })),
    )
    expect(result.current.coverImageName).toBe('cover.jpg')
  })

  it('liefert leere Listen wenn keine Frontmatter-Werte gesetzt sind', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useResolvedSessionMedia(makeArgs()))
    expect(result.current.attachmentNames).toEqual([])
    expect(result.current.galleryImageNames).toEqual([])
    expect(result.current.coverImageName).toBe('')
  })

  it('absolute http-URLs werden direkt durchgereicht (kein API-Call)', async () => {
    const { result } = renderHook(() =>
      useResolvedSessionMedia(makeArgs({
        attachmentsUrl: ['https://example.com/file.pdf'],
      })),
    )

    await waitFor(() => expect(result.current.resolvedAttachments.length).toBe(1))

    expect(result.current.resolvedAttachments[0].name).toBe('https://example.com/file.pdf')
    expect(result.current.resolvedAttachments[0].url).toBe('https://example.com/file.pdf')
    // Resolver-API wurde nicht aufgerufen (keine relativen Pfade)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('relative Dateinamen werden via Resolver-API aufgeloest', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ resolvedUrl: 'https://blob.example.com/abc.pdf' }),
    })

    const { result } = renderHook(() =>
      useResolvedSessionMedia(makeArgs({ attachmentsUrl: ['attachment.pdf'] })),
    )

    await waitFor(() => expect(result.current.resolvedAttachments.length).toBe(1))

    expect(result.current.resolvedAttachments[0].url).toBe('https://blob.example.com/abc.pdf')
    expect(fetchMock).toHaveBeenCalled()
  })

  it('resolvedCoverImageUrl wird via Resolver gesetzt', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ resolvedUrl: 'https://blob.example.com/cover.jpg' }),
    })

    const { result } = renderHook(() =>
      useResolvedSessionMedia(makeArgs({ coverImageUrl: 'cover.jpg' })),
    )

    await waitFor(() => expect(result.current.resolvedCoverImageUrl).toBeDefined())
    expect(result.current.resolvedCoverImageUrl).toBe('https://blob.example.com/cover.jpg')
  })

  it('unresolvedAttachmentNames listet Namen ohne URL', async () => {
    // Resolver gibt 404
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })

    const { result } = renderHook(() =>
      useResolvedSessionMedia(makeArgs({
        attachmentsUrl: ['missing.pdf'],
        getDisplayFileName: (v) => v.replace('.pdf', ''),
      })),
    )

    await waitFor(() => expect(result.current.resolvedAttachments.length).toBe(1))

    expect(result.current.resolvedAttachments[0].url).toBeUndefined()
    expect(result.current.unresolvedAttachmentNames).toEqual(['missing'])
  })

  it('markGalleryUrlAsFailed updated failedGalleryUrls', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useResolvedSessionMedia(makeArgs()))

    expect(result.current.failedGalleryUrls.has('https://example.com/img.jpg')).toBe(false)

    act(() => {
      result.current.markGalleryUrlAsFailed('https://example.com/img.jpg')
    })

    expect(result.current.failedGalleryUrls.has('https://example.com/img.jpg')).toBe(true)
  })

  it('markGalleryUrlAsFailed mehrmals mit gleicher URL ist idempotent', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useResolvedSessionMedia(makeArgs()))

    act(() => {
      result.current.markGalleryUrlAsFailed('https://x.com/a.jpg')
      result.current.markGalleryUrlAsFailed('https://x.com/a.jpg')
      result.current.markGalleryUrlAsFailed('https://x.com/a.jpg')
    })

    expect(result.current.failedGalleryUrls.size).toBe(1)
  })

  it('liefert undefined fuer resolvedCoverImageUrl wenn keine coverImageUrl gesetzt', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useResolvedSessionMedia(makeArgs()))
    expect(result.current.resolvedCoverImageUrl).toBeUndefined()
  })
})
