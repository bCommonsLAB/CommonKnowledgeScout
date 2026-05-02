// @vitest-environment jsdom

/**
 * Characterization Tests fuer `DocumentCard`-Switch (Welle 3-III-a, Schritt 3).
 *
 * Sicherheitsnetz fuer den document-card Sub-Komponenten-Split. Fixiert:
 * - Switch-Logik: welche Card wird bei welchem detailViewType gerendert?
 * - Fallback: doc.detailViewType > libraryDetailViewType
 * - Klick-Verhalten: openDocumentBySlug wird mit korrektem Slug aufgerufen,
 *   sonst onClick-Fallback
 * - Default-Card (kein bekannter Type) rendert mit Titel
 *
 * Mocks:
 * - next/image (vermeidet Next.js-Image-Loader)
 * - next/navigation (Router/Pathname/SearchParams)
 * - resolve-cover-url-client (DivaTextureCard ruft API)
 * - utils/document-navigation (openDocumentBySlug)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { DocumentCard } from '@/components/library/gallery/document-card'
import type { DocCardMeta } from '@/lib/gallery/types'

// Sammle Aufrufe von openDocumentBySlug zentral, damit Tests die
// Aufrufe pro Klick gegenzaehlen koennen.
const openDocumentBySlugMock = vi.fn()

vi.mock('next/image', () => ({
  default: (props: { src?: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} data-testid="next-image-mock" />
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/library/test/gallery',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/utils/document-navigation', () => ({
  openDocumentBySlug: (...args: unknown[]) => openDocumentBySlugMock(...args),
}))

vi.mock('@/utils/document-slug', () => ({
  getEffectiveDocumentNavigationSlug: (doc: DocCardMeta) => doc.fileId || doc.id || null,
}))

vi.mock('@/lib/gallery/resolve-cover-url-client', () => ({
  coverRefNeedsApiResolution: () => false,
  resolveCoverUrlViaApi: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/gallery/cover-ref-display-name', () => ({
  displayBasenameFromCoverRef: (ref?: string) => ref || '',
}))

vi.mock('@/lib/i18n/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'defaultValue' in opts) return String(opts.defaultValue)
      return key
    },
  }),
}))

vi.mock('@/components/library/gallery/speaker-icons', () => ({
  SpeakerOrAuthorIcons: () => <div data-testid="speaker-icons-mock" />,
}))

function makeDoc(overrides: Partial<DocCardMeta> = {}): DocCardMeta {
  return {
    id: 'doc-1',
    fileId: 'file-1',
    title: 'Mein Dokument',
    fileName: 'mein-dokument.md',
    ...overrides,
  } as DocCardMeta
}

describe('DocumentCard (Switch)', () => {
  beforeEach(() => {
    openDocumentBySlugMock.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert Standard-Card (Buecher/Dokumente), wenn kein detailViewType gesetzt ist', () => {
    render(<DocumentCard doc={makeDoc({ title: 'Standard-Buch' })} libraryId="lib-1" />)
    // Standard-Card zeigt Titel als CardTitle
    expect(screen.getByText('Standard-Buch')).toBeTruthy()
  })

  it('rendert ClimateActionCard bei detailViewType="climateAction"', () => {
    render(
      <DocumentCard
        doc={makeDoc({
          shortTitle: 'Klimamassnahme XYZ',
          category: 'Energie',
          lv_bewertung: 'in_umsetzung',
        })}
        libraryId="lib-1"
        libraryDetailViewType="climateAction"
      />
    )
    expect(screen.getByText('Klimamassnahme XYZ')).toBeTruthy()
    expect(screen.getByText('Energie')).toBeTruthy()
  })

  it('rendert SessionCard bei detailViewType="session"', () => {
    render(
      <DocumentCard
        doc={makeDoc({
          shortTitle: 'Konferenz Talk',
          speakers: ['Dr. Maria Mueller'],
        })}
        libraryId="lib-1"
        libraryDetailViewType="session"
      />
    )
    expect(screen.getByText('Konferenz Talk')).toBeTruthy()
    expect(screen.getByText('Dr. Maria Mueller')).toBeTruthy()
  })

  it('rendert RefurbedDeviceCard bei detailViewType="refurbedDevice"', () => {
    render(
      <DocumentCard
        doc={makeDoc({
          modell: 'ThinkPad T480',
          geraetetyp: 'Notebook',
          prozessor: 'Intel i5',
        })}
        libraryId="lib-1"
        libraryDetailViewType="refurbedDevice"
      />
    )
    expect(screen.getByText('ThinkPad T480')).toBeTruthy()
  })

  it('bevorzugt doc.detailViewType ueber libraryDetailViewType', () => {
    render(
      <DocumentCard
        doc={makeDoc({
          shortTitle: 'Session-Doc',
          detailViewType: 'session',
          speakers: ['Test Speaker'],
        })}
        libraryId="lib-1"
        libraryDetailViewType="climateAction"
      />
    )
    // Wenn doc.detailViewType='session' gewinnt, sehen wir SessionCard mit Speaker
    expect(screen.getByText('Test Speaker')).toBeTruthy()
  })

  it('ruft openDocumentBySlug bei Klick auf, wenn libraryId + slug vorhanden', () => {
    render(<DocumentCard doc={makeDoc()} libraryId="lib-1" />)
    const card = screen.getByText('Mein Dokument').closest('[onclick], div[role], article, .cursor-pointer')
    if (!card) throw new Error('Keine klickbare Card gefunden')
    fireEvent.click(card)
    expect(openDocumentBySlugMock).toHaveBeenCalledTimes(1)
  })

  it('ruft onClick-Fallback auf, wenn libraryId fehlt', () => {
    const onClick = vi.fn()
    render(<DocumentCard doc={makeDoc()} onClick={onClick} />)
    const card = screen.getByText('Mein Dokument').closest('[onclick], div[role], article, .cursor-pointer')
    if (!card) throw new Error('Keine klickbare Card gefunden')
    fireEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(openDocumentBySlugMock).not.toHaveBeenCalled()
  })
})
