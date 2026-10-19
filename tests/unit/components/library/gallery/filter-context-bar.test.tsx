// @vitest-environment jsdom

/**
 * Smoke-Tests fuer die Sterne-Toggles in `FilterContextBar`.
 *
 * Sicherheitsnetz fuer:
 * - Toggle "Nur Favoriten" (URL-Param `?favorites=1`)
 * - Knopf „Im Fokus" (URL-Params `?starred=1&sort=stars`, Welle F2 / ADR 0012):
 *   fuer Mitglieder immer, fuer Besucher nur bei starCountsPublic
 * - Toggle "Mit Kommentaren" (URL-Param `?commented=1`)
 * - Toggle "Nach Sternen sortieren" (URL-Param `?sort=stars`)
 * - Alle Toggles sind nur fuer Member sichtbar.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { FilterContextBar } from '@ks/module-explorer/gallery/components/filter-context-bar'

const pushMock = vi.fn()
let currentSearch = ''

// Seit M4f schreibt die Leiste nicht mehr selbst in die Adresse, sondern sagt
// `pushParams(next)`. Der Mock zeichnet auf, was sie sagen wollte.
vi.mock('@ks/module-explorer/gallery/contexts/gallery-navigation-context', () => ({
  useGalleryNavigation: () => ({
    params: new URLSearchParams(currentSearch),
    pushParams: (next: URLSearchParams) => pushMock(next.toString()),
  }),
}))

let mockIsMember = true
let mockStarCountsPublic = false
vi.mock('@ks/module-explorer/gallery/hooks/use-library-role', () => ({
  useLibraryRole: () => ({
    isMember: mockIsMember,
    isSignedIn: true,
    role: 'owner',
    isLoading: false,
  }),
}))
vi.mock('@ks/module-explorer/gallery/hooks/use-star-counts-public', () => ({
  useSterneSichtbar: () => ({
    isMember: mockIsMember,
    starCountsPublic: mockStarCountsPublic,
    sterneSichtbar: mockIsMember || mockStarCountsPublic,
  }),
}))

vi.mock('@ks/i18n/react', () => ({
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

vi.mock('@ks/module-explorer/gallery/atoms/gallery-filters', () => ({
  galleryFiltersAtom: { toString: () => 'galleryFilters' },
}))

vi.mock('@ks/module-explorer/gallery/components/view-mode-toggle', () => ({
  ViewModeToggle: () => <div data-testid="view-mode-toggle" />,
}))
vi.mock('@ks/module-explorer/gallery/components/gallery-card-density-toggle', () => ({
  GalleryCardDensityToggle: () => <div data-testid="density-toggle" />,
}))
vi.mock('@ks/module-explorer/gallery/components/bulk-delete-button', () => ({
  BulkDeleteButton: () => <div data-testid="bulk-delete" />,
}))
vi.mock('@ks/module-explorer/gallery/components/bulk-publish-button', () => ({
  BulkPublishButton: () => <div data-testid="bulk-publish" />,
}))
vi.mock('@ks/module-explorer/gallery/components/fokus-umschalter', () => ({
  FokusUmschalter: () => <div data-testid="fokus-umschalter" />,
}))

describe('FilterContextBar / Sterne-Toggles', () => {
  beforeEach(() => {
    pushMock.mockClear()
    currentSearch = ''
    mockIsMember = true
    mockStarCountsPublic = false
  })
  afterEach(() => cleanup())

  it('rendert Sort-by-stars-Button fuer Member', () => {
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" />)
    expect(screen.getByTitle('Nach Sternen sortieren')).toBeTruthy()
  })

  it('versteckt alle Toggles fuer Nicht-Member', () => {
    mockIsMember = false
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" />)
    expect(screen.queryByTitle('Nach Sternen sortieren')).toBeNull()
    expect(screen.queryByTitle('Nur meine eigenen Favoriten')).toBeNull()
    expect(screen.queryByTitle('Einträge mit mindestens einem Stern, die meisten zuerst')).toBeNull()
    expect(screen.queryByTitle('Nur Quellen mit Kommentaren')).toBeNull()
  })

  it('zeigt „Im Fokus" fuer Besucher, wenn die Library die Sterne-Zahl freigibt (ADR 0012)', () => {
    mockIsMember = false
    mockStarCountsPublic = true
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" />)
    expect(screen.getByTitle('Einträge mit mindestens einem Stern, die meisten zuerst')).toBeTruthy()
    // Mitglieder-Knoepfe bleiben verborgen
    expect(screen.queryByTitle('Nur meine eigenen Favoriten')).toBeNull()
    expect(screen.queryByTitle('Nach Sternen sortieren')).toBeNull()
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
    fireEvent.click(screen.getByTitle('Nur meine eigenen Favoriten'))
    const url = String(pushMock.mock.calls[0][0])
    expect(url).toContain('favorites=1')
  })

  it('G2 geführt: Mitglieder-Knoepfe und Sortierung weg, Umschalter statt Fokus-Knopf', () => {
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" profil="gefuehrt" showRatingSort />)
    expect(screen.getByTestId('fokus-umschalter')).toBeTruthy()
    expect(screen.queryByTitle('Einträge mit mindestens einem Stern, die meisten zuerst')).toBeNull()
    expect(screen.queryByTitle('Nur meine eigenen Favoriten')).toBeNull()
    expect(screen.queryByTitle('Nach Sternen sortieren')).toBeNull()
    expect(screen.queryByTitle('Nur Quellen mit Kommentaren')).toBeNull()
    expect(screen.queryByTitle('Nach Prioritäts-Indikator sortieren')).toBeNull()
    // Filter-Knopf bleibt (oeffnet die Lade)
    expect(screen.getByText('gallery.filter')).toBeTruthy()
  })

  it('Experte: alles wie bisher, kein Umschalter', () => {
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" showRatingSort />)
    expect(screen.queryByTestId('fokus-umschalter')).toBeNull()
    expect(screen.getByTitle('Nach Prioritäts-Indikator sortieren')).toBeTruthy()
  })

  it('Klick auf „Im Fokus" setzt starred=1 UND sort=stars', () => {
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" />)
    fireEvent.click(screen.getByTitle('Einträge mit mindestens einem Stern, die meisten zuerst'))
    const url = String(pushMock.mock.calls[0][0])
    expect(url).toContain('starred=1')
    expect(url).toContain('sort=stars')
  })

  it('Klick auf „Im Fokus" entfernt starred und sort=stars, laesst andere Params stehen', () => {
    currentSearch = 'starred=1&sort=stars&favorites=1'
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" />)
    fireEvent.click(screen.getByTitle('Einträge mit mindestens einem Stern, die meisten zuerst'))
    const url = String(pushMock.mock.calls[0][0])
    expect(url).not.toContain('starred=1')
    expect(url).not.toContain('sort=stars')
    expect(url).toContain('favorites=1')
  })

  it('Klick auf Mit-Kommentaren setzt URL-Param ?commented=1', () => {
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" />)
    fireEvent.click(screen.getByTitle('Nur Quellen mit Kommentaren'))
    const url = String(pushMock.mock.calls[0][0])
    expect(url).toContain('commented=1')
  })
})

describe('FilterContextBar / Slots des geführten Profils (G4)', () => {
  afterEach(() => cleanup())

  it('zeigt Suche und rechte Werkzeuge vor dem Story-Knopf; ohne Slots bleibt die Leiste wie bisher', () => {
    render(
      <FilterContextBar
        docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" profil="gefuehrt"
        suche={<input data-testid="suche" />} werkzeugeRechts={<button data-testid="rechts">Experte</button>}
        ctaLabel="Story" onCta={() => {}}
      />,
    )
    // Suche steht zweimal im Baum: in der Zeile (ab lg) und als eigene Zeile (unter lg)
    const [suche, sucheMobil] = screen.getAllByTestId('suche')
    expect(sucheMobil.parentElement?.className).toContain('lg:hidden')
    const rechts = screen.getByTestId('rechts')
    const story = screen.getByRole('button', { name: 'Story' })
    expect(suche.compareDocumentPosition(rechts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(rechts.compareDocumentPosition(story) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    cleanup()
    render(<FilterContextBar docCount={5} onOpenFilters={() => {}} onClear={() => {}} libraryId="lib-1" ctaLabel="Story" onCta={() => {}} />)
    expect(screen.queryAllByTestId('suche')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Story' }).parentElement?.className).toContain('ml-auto')
  })
})
