// @vitest-environment jsdom

/**
 * Welle F2 (ADR 0012): `useGalleryData` schickt `starred=1` an die
 * Docs-Route, wenn „Im Fokus" aktiv ist — der Server filtert, nicht der
 * Browser. Dazu Facetten- und Summen-Hook mit demselben Parameter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGalleryData } from '@ks/module-explorer/gallery/hooks/use-gallery-data'
import { useGalleryFacets } from '@ks/module-explorer/gallery/hooks/use-gallery-facets'
import { useGallerySums } from '@ks/module-explorer/gallery/hooks/use-gallery-sums'

const fetchMock = vi.fn()
// Stabiles Objekt: `instanz` steht in den Effekt-Deps der Hooks — ein neues
// Objekt je Render liefe sonst in eine Endlosschleife.
const instanz = { fetch: fetchMock }

vi.mock('@ks/module-explorer/gallery/contexts/gallery-host-context', () => ({
  useInstanz: () => instanz,
}))

function jsonAntwort(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => body,
  }
}

function aufgerufeneUrls(): string[] {
  return fetchMock.mock.calls.map((c) => String(c[0]))
}

describe('starred=1 geht an den Server', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(jsonAntwort({ items: [], total: 0, groups: [], totalGroups: 0, facets: [], viewTypes: [], sums: {} }))
  })

  it('useGalleryData: mit starred=1, ohne Option kein Parameter', async () => {
    renderHook(() => useGalleryData({}, 'gallery', '', 'lib-1', { groupByField: 'none', starred: true }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(aufgerufeneUrls()[0]).toContain('/api/chat/lib-1/docs?')
    expect(aufgerufeneUrls()[0]).toContain('starred=1')

    fetchMock.mockClear()
    renderHook(() => useGalleryData({}, 'gallery', '', 'lib-1', { groupByField: 'none' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(aufgerufeneUrls()[0]).not.toContain('starred')
  })

  it('useGalleryFacets und useGallerySums: derselbe Parameter', async () => {
    renderHook(() => useGalleryFacets('lib-1', {}, { starred: true }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(aufgerufeneUrls()[0]).toContain('/facets?')
    expect(aufgerufeneUrls()[0]).toContain('starred=1')

    fetchMock.mockClear()
    renderHook(() => useGallerySums({}, '', 'lib-1', { enabled: true, starred: true }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(aufgerufeneUrls()[0]).toContain('aggregate=sums')
    expect(aufgerufeneUrls()[0]).toContain('starred=1')
  })
})
