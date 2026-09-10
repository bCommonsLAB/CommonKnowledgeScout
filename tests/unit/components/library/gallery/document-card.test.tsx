// @vitest-environment jsdom

/**
 * Characterization Tests fuer `DocumentCard`-Switch (Welle 3-III-a, Schritt 3).
 *
 * Sicherheitsnetz fuer den document-card Sub-Komponenten-Split. Fixiert:
 * - Switch-Logik: welche Card wird bei welchem detailViewType gerendert?
 * - Fallback: doc.detailViewType > libraryDetailViewType
 * - Klick-Verhalten: die Adressierung wird mit korrektem Slug aufgerufen,
 *   sonst onClick-Fallback
 * - Default-Card (kein bekannter Type) rendert mit Titel
 *
 * Mocks:
 * - resolve-cover-url-client (DivaTextureCard ruft API)
 * - gallery-navigation-context (die Adressierung)
 *
 * Seit Teil A der Adressierungs-Welle holt `DocumentCard` keinen Router mehr.
 * Sie sagt nur noch `openDocument(slug)`; wer daraus eine Adresse macht,
 * entscheidet der Montagepunkt. Der Mock sitzt deshalb am Kontext.
 */

import type React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { DocumentCard } from '@ks/module-explorer/gallery/components/document-card'
import { GalleryHostProvider, STILLER_GASTGEBER } from '@ks/module-explorer/gallery/contexts/gallery-host-context'
import {
  ANONYMOUS_VIEWER,
  GalleryViewerProvider,
  type GalleryViewer,
} from '@ks/module-explorer/gallery/contexts/gallery-viewer-context'
import { Provider as JotaiProvider, createStore } from 'jotai'
import { useEffect } from 'react'
import { useSetLibraries } from '@ks/shell/react'
import type { ClientLibrary } from '@ks/contracts'
import type { DocCardMeta } from '@ks/module-explorer/gallery/lib/types'

// Sammle Aufrufe der Adressierung zentral, damit Tests die
// Aufrufe pro Klick gegenzaehlen koennen.
const openDocumentMock = vi.fn()

vi.mock('@ks/module-explorer/gallery/contexts/gallery-navigation-context', () => ({
  useGalleryNavigation: () => ({
    openDocument: (...args: unknown[]) => openDocumentMock(...args),
    closeDocument: vi.fn(),
    documentShareUrl: () => '',
  }),
}))

vi.mock('@ks/util', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ks/util')>()),
  getEffectiveDocumentNavigationSlug: (doc: DocCardMeta) => doc.fileId || doc.id || null,
}))

vi.mock('@ks/module-explorer/gallery/lib/resolve-cover-url-client', () => ({
  coverRefNeedsApiResolution: () => false,
  coverUrlAufInstanz: (url: string) => url,
  resolveCoverUrlViaApi: vi.fn().mockResolvedValue(null),
}))

vi.mock('@ks/module-explorer/gallery/lib/cover-ref-display-name', () => ({
  displayBasenameFromCoverRef: (ref?: string) => ref || '',
}))

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'defaultValue' in opts) return String(opts.defaultValue)
      return key
    },
  }),
}))

vi.mock('@ks/module-explorer/gallery/components/speaker-icons', () => ({
  SpeakerOrAuthorIcons: () => <div data-testid="speaker-icons-mock" />,
}))

vi.mock('@ks/module-explorer/gallery/components/source-stars-badge', () => ({
  SourceStarsBadge: (props: { libraryId?: string; fileId?: string }) => (
    <div data-testid="source-stars-badge-mock" data-library={props.libraryId} data-file={props.fileId} />
  ),
}))

vi.mock('@ks/module-explorer/gallery/components/source-comments-badge', () => ({
  SourceCommentsBadge: (props: { libraryId?: string; fileId?: string }) => (
    <div data-testid="source-comments-badge-mock" data-library={props.libraryId} data-file={props.fileId} />
  ),
}))

/**
 * Die Karten fragen den Gastgeber nach dem Bild-Renderer (M4f), die DIVA-Karte
 * zusaetzlich den Betrachter nach seiner Rolle (M5). Default: anonym, wie im Embed.
 */
function render(ui: React.ReactElement, viewer: GalleryViewer = ANONYMOUS_VIEWER) {
  return rtlRender(
    <GalleryViewerProvider viewer={viewer}>
      <GalleryHostProvider host={STILLER_GASTGEBER}>{ui}</GalleryHostProvider>
    </GalleryViewerProvider>,
  )
}

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
    openDocumentMock.mockClear()
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

  it('oeffnet das Dokument bei Klick, wenn libraryId + slug vorhanden', () => {
    render(<DocumentCard doc={makeDoc()} libraryId="lib-1" />)
    const card = screen.getByText('Mein Dokument').closest('[onclick], div[role], article, .cursor-pointer')
    if (!card) throw new Error('Keine klickbare Card gefunden')
    fireEvent.click(card)
    expect(openDocumentMock).toHaveBeenCalledTimes(1)
  })

  it('ruft onClick-Fallback auf, wenn libraryId fehlt', () => {
    const onClick = vi.fn()
    render(<DocumentCard doc={makeDoc()} onClick={onClick} />)
    const card = screen.getByText('Mein Dokument').closest('[onclick], div[role], article, .cursor-pointer')
    if (!card) throw new Error('Keine klickbare Card gefunden')
    fireEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(openDocumentMock).not.toHaveBeenCalled()
  })

  it('reicht libraryId + fileId an die SourceStarsBadge in jeder Card-Variante durch', () => {
    const variants: Array<{ type?: string; doc: DocCardMeta }> = [
      { type: undefined, doc: makeDoc({ title: 'Std' }) },
      { type: 'climateAction', doc: makeDoc({ shortTitle: 'Klima' }) },
      { type: 'session', doc: makeDoc({ shortTitle: 'Talk' }) },
      { type: 'refurbedDevice', doc: makeDoc({ modell: 'X1' }) },
      { type: 'divaTexture', doc: makeDoc({ title: 'Textur' }) },
    ]
    for (const v of variants) {
      const { unmount } = render(
        <DocumentCard doc={v.doc} libraryId="lib-99" libraryDetailViewType={v.type} />,
      )
      const badge = screen.getByTestId('source-stars-badge-mock')
      expect(badge.getAttribute('data-library')).toBe('lib-99')
      expect(badge.getAttribute('data-file')).toBe('file-1')
      unmount()
    }
  })
})

describe('DIVA-Karte: Schreib-Aktionen nur fuer Mitglieder (M5)', () => {
  afterEach(() => {
    cleanup()
  })

  const diva = makeDoc({ title: 'Textur', detailViewType: 'divaTexture' })

  it('zeigt anonymen Besuchern keine Klassifikations-Aktionen — der Embed-Fall', () => {
    // Bis M5 erschien das Menue auch anonym; der Server lehnte den PATCH ab,
    // aber im Embed duerfen Schreib-Aktionen gar nicht erst auftauchen.
    render(<DocumentCard doc={diva} libraryId="lib-99" />)
    expect(screen.queryByLabelText('Klassifikations-Aktionen')).toBeNull()
  })

  it('zeigt sie Owner/Co-Creator der Library (Gegenprobe)', async () => {
    function MitLibrary({ children }: { children: React.ReactNode }) {
      const setLibraries = useSetLibraries()
      useEffect(() => {
        setLibraries([{ id: 'lib-99', label: 'Texturen' } as ClientLibrary])
      }, [setLibraries])
      return <>{children}</>
    }
    const angemeldet: GalleryViewer = {
      isLoaded: true,
      isSignedIn: true,
      email: 'owner@example.org',
      displayName: 'Owner',
    }

    render(
      <JotaiProvider store={createStore()}>
        <MitLibrary>
          <DocumentCard doc={diva} libraryId="lib-99" />
        </MitLibrary>
      </JotaiProvider>,
      angemeldet,
    )

    expect(await screen.findByLabelText('Klassifikations-Aktionen')).toBeDefined()
  })
})
