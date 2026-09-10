// @vitest-environment jsdom

/**
 * Characterization Tests fuer `ItemsGrid` (Welle 3-III, Schritt 3).
 *
 * Sicherheitsnetz fuer Sub-Welle 3-III-a. Fixiert:
 * - Render-Smoke mit Items-Mock pro Gruppe
 * - Gruppen-Header werden angezeigt, wenn groupByField !== 'none'
 * - Bei groupByField='none' werden keine Header gerendert
 * - DocumentCard wird pro Item gerendert (Mock)
 * - Seit M5: die Stoffgruppen-Aktionen (DIVA) nur fuer Owner/Co-Creator
 *
 * DocumentCard wird gemockt, weil sie 638 Zeilen hat und nicht
 * zentral fuer den ItemsGrid-Vertrag ist.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEffect, type ReactElement, type ReactNode } from 'react'
import { cleanup, render as rtlRender, screen } from '@testing-library/react'
import { Provider as JotaiProvider, createStore } from 'jotai'
import { useSetLibraries } from '@ks/shell/react'
import type { ClientLibrary } from '@ks/contracts'
import { ItemsGrid } from '@ks/module-explorer/gallery/components/items-grid'
import { GalleryHostProvider, STILLER_GASTGEBER } from '@ks/module-explorer/gallery/contexts/gallery-host-context'
import {
  ANONYMOUS_VIEWER,
  GalleryViewerProvider,
  type GalleryViewer,
} from '@ks/module-explorer/gallery/contexts/gallery-viewer-context'
import type { DocCardMeta } from '@ks/module-explorer/gallery/lib/types'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'year' in opts) return `${key}:${String(opts.year)}`
      return key
    },
  }),
}))

vi.mock('@ks/module-explorer/gallery/components/document-card', () => ({
  DocumentCard: ({ doc }: { doc: DocCardMeta }) => (
    <div data-testid="document-card-mock" data-id={doc.id}>{doc.title || doc.fileName}</div>
  ),
}))

/** Das Raster fragt den Gastgeber nach der Instanz und den Betrachter nach seiner Rolle (M5). */
function render(ui: ReactElement, viewer: GalleryViewer = ANONYMOUS_VIEWER) {
  return rtlRender(
    <GalleryViewerProvider viewer={viewer}>
      <GalleryHostProvider host={STILLER_GASTGEBER}>{ui}</GalleryHostProvider>
    </GalleryViewerProvider>,
  )
}

function makeDoc(id: string, title: string): DocCardMeta {
  return {
    id,
    title,
    fileName: title,
  } as DocCardMeta
}

describe('ItemsGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert nichts, wenn docsByYear leer ist', () => {
    const { container } = render(<ItemsGrid docsByYear={[]} />)
    // Aeusseres div + keine Children
    expect(container.querySelectorAll('[data-testid="document-card-mock"]').length).toBe(0)
  })

  it('rendert Gruppen-Header bei groupByField="year" (Default)', () => {
    const docs: Array<[number | string, DocCardMeta[]]> = [
      [2023, [makeDoc('a', 'Doc A')]],
      [2024, [makeDoc('b', 'Doc B')]],
    ]
    render(<ItemsGrid docsByYear={docs} />)
    expect(screen.getByText('gallery.year:2023')).toBeTruthy()
    expect(screen.getByText('gallery.year:2024')).toBeTruthy()
  })

  it('rendert NoYear-Label fuer "Ohne Jahrgang"-Gruppe', () => {
    const docs: Array<[number | string, DocCardMeta[]]> = [
      ['Ohne Jahrgang', [makeDoc('x', 'Doc X')]],
    ]
    render(<ItemsGrid docsByYear={docs} />)
    expect(screen.getByText('gallery.noYear')).toBeTruthy()
  })

  it('rendert Gruppen-Schluessel als String bei groupByField="category"', () => {
    const docs: Array<[number | string, DocCardMeta[]]> = [
      ['Politik', [makeDoc('a', 'Doc A')]],
      ['Wissenschaft', [makeDoc('b', 'Doc B')]],
    ]
    render(<ItemsGrid docsByYear={docs} groupByField="category" />)
    expect(screen.getByText('Politik')).toBeTruthy()
    expect(screen.getByText('Wissenschaft')).toBeTruthy()
  })

  it('rendert KEINE Gruppen-Header bei groupByField="none"', () => {
    const docs: Array<[number | string, DocCardMeta[]]> = [
      [2023, [makeDoc('a', 'Doc A')]],
    ]
    render(<ItemsGrid docsByYear={docs} groupByField="none" />)
    // Kein Header sichtbar — nur das DocumentCard-Mock
    expect(screen.queryByText('gallery.year:2023')).toBeNull()
    expect(screen.getByTestId('document-card-mock')).toBeTruthy()
  })

  it('rendert pro Document ein DocumentCard-Mock', () => {
    const docs: Array<[number | string, DocCardMeta[]]> = [
      [2023, [makeDoc('a', 'Doc A'), makeDoc('b', 'Doc B'), makeDoc('c', 'Doc C')]],
    ]
    render(<ItemsGrid docsByYear={docs} />)
    const cards = screen.getAllByTestId('document-card-mock')
    expect(cards).toHaveLength(3)
    expect(cards[0].getAttribute('data-id')).toBe('a')
    expect(cards[2].getAttribute('data-id')).toBe('c')
  })
})

describe('ItemsGrid: Stoffgruppen-Aktionen nur fuer Mitglieder (M5)', () => {
  afterEach(() => {
    cleanup()
  })

  const gruppen: Array<[number | string, DocCardMeta[]]> = [['Leinen', [makeDoc('a', 'Doc A')]]]

  it('zeigt anonymen Besuchern weder „Gruppe propagieren" noch die DIVA-Leiste', () => {
    // Bis M5 erschienen beide Knoepfe auch anonym; die Route schreibt und
    // verlangt Zugriff auf die Library. Im Embed duerfen sie gar nicht auftauchen.
    render(<ItemsGrid docsByYear={gruppen} groupByField="group_name" libraryId="lib-1" />)
    expect(screen.queryByText('Gruppe propagieren')).toBeNull()
    expect(screen.queryByText(/Alle Gruppen propagieren/)).toBeNull()
  })

  it('zeigt sie Owner/Co-Creator der Library (Gegenprobe)', async () => {
    function MitLibrary({ children }: { children: ReactNode }) {
      const setLibraries = useSetLibraries()
      useEffect(() => {
        setLibraries([{ id: 'lib-1', label: 'Texturen' } as ClientLibrary])
      }, [setLibraries])
      return <>{children}</>
    }
    const mitglied: GalleryViewer = {
      isLoaded: true,
      isSignedIn: true,
      email: 'owner@example.org',
      displayName: 'Owner',
    }

    render(
      <JotaiProvider store={createStore()}>
        <MitLibrary>
          <ItemsGrid docsByYear={gruppen} groupByField="group_name" libraryId="lib-1" />
        </MitLibrary>
      </JotaiProvider>,
      mitglied,
    )

    expect(await screen.findByText('Gruppe propagieren')).toBeTruthy()
    expect(screen.getByText(/Alle Gruppen propagieren/)).toBeTruthy()
  })
})
