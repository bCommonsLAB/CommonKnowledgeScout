// @vitest-environment jsdom

/**
 * Smoke-Tests fuer die Sterne-Toggles in `FilterContextBar` (Welle B).
 *
 * Sicherheitsnetz fuer:
 * - Toggle "Nur Favoriten" (URL-Param `?favorites=1`)
 * - Toggle "Nach Sternen sortieren" (URL-Param `?sort=stars`)
 * - Beide Buttons sind nur fuer Member sichtbar.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { FilterContextBar } from '@/components/library/filter-context-bar'

const pushMock = vi.fn()
let currentSearch = ''

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/library/lib-1/gallery',
  useSearchParams: () => new URLSearchParams(currentSearch),
}))

let mockIsMember = true
vi.mock('@/hooks/gallery/use-library-role', () => ({
  useLibraryRole: () => ({
    isMember: mockIsMember,
    isSignedIn: true,
    role: 'owner',
    isLoading: false,
  }),
}))

vi.mock('@/lib/i18n/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'defaultValue' in opts) return String(opts.defaultValue)
      return key
    },
    locale: 'de',
  }),
}))

vi.mock('jotai', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('jotai')
  return { ...actual, useAtomValue: () => ({}) }
})

vi.mock('@/atoms/gallery-filters', () => ({
  galleryFiltersAtom: { toString: () => 'galleryFilters' },
}))

vi.mock('@/components/library/gallery/view-mode-toggle', () => ({
  ViewModeToggle: () => <div data-testid="view-mode-toggle" />,
}))
vi.mock('@/components/library/gallery/gallery-card-density-toggle', () => ({
  GalleryCardDensityToggle: () => <div data-testid="density-toggle" />,
}))
vi.mock('@/components/library/gallery/bulk-delete-button', () => ({
  BulkDeleteButton: () => <div data-testid="bulk-delete" />,
}))
vi.mock('@/components/library/gallery/bulk-publish-button', () => ({
  BulkPublishButton: () => <div data-testid="bulk-publish" />,
}))

describe('FilterContextBar / Sterne-Toggles', () => {
  beforeEach(() => {
    pushMock.mockClear()
    currentSearch = ''
    mockIsMember = true
  })
  afterEach(() => cleanup())

  it('rendert Sort-by-stars-Button fuer Member', () => {
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" />)
    expect(screen.getByTitle('Nach Sternen sortieren')).toBeTruthy()
  })

  it('versteckt beide Toggles fuer Nicht-Member', () => {
    mockIsMember = false
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" />)
    expect(screen.queryByTitle('Nach Sternen sortieren')).toBeNull()
    expect(screen.queryByTitle('Nur Favoriten')).toBeNull()
  })

  it('Klick auf Sort-by-stars setzt URL-Param ?sort=stars', () => {
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" />)
    fireEvent.click(screen.getByTitle('Nach Sternen sortieren'))
    expect(pushMock).toHaveBeenCalledTimes(1)
    const url = String(pushMock.mock.calls[0][0])
    expect(url).toContain('sort=stars')
  })

  it('Klick auf Sort-by-stars entfernt sort, wenn schon aktiv', () => {
    currentSearch = 'sort=stars&favorites=1'
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" />)
    fireEvent.click(screen.getByTitle('Nach Sternen sortieren'))
    const url = String(pushMock.mock.calls[0][0])
    expect(url).not.toContain('sort=stars')
    expect(url).toContain('favorites=1')
  })

  it('Klick auf Nur-Favoriten setzt URL-Param ?favorites=1', () => {
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" />)
    fireEvent.click(screen.getByTitle('Nur Favoriten'))
    const url = String(pushMock.mock.calls[0][0])
    expect(url).toContain('favorites=1')
  })
})
