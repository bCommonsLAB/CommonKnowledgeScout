// @vitest-environment jsdom

/**
 * Klima-Karte in zwei Dichten (Owner-Befund 19.10.2026: Galerie zu dicht).
 *
 * Kompakt (dichtes Raster, Website-Banner): nur Titel, Status als Punkt mit
 * Text im Tooltip, Sterne-Zahl. Nr., Prio, Kategorie und Kommentare fehlen.
 * Komfortabel: unveraendert — alles da. Keine Snapshots, nur Text-Abfragen;
 * Fixtures sind erfunden.
 */

import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render as rtlRender, screen } from '@testing-library/react'
import { DocumentCard } from '@ks/module-explorer/gallery/components/document-card'
import { GalleryHostProvider, STILLER_GASTGEBER } from '@ks/module-explorer/gallery/contexts/gallery-host-context'
import { ANONYMOUS_VIEWER, GalleryViewerProvider } from '@ks/module-explorer/gallery/contexts/gallery-viewer-context'
import type { DocCardMeta } from '@ks/module-explorer/gallery/lib/types'

vi.mock('@ks/module-explorer/gallery/contexts/gallery-navigation-context', () => ({
  useGalleryNavigation: () => ({ openDocument: vi.fn(), closeDocument: vi.fn(), documentShareUrl: () => '' }),
}))

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'defaultValue' in opts ? String(opts.defaultValue) : key,
  }),
}))

vi.mock('@ks/module-explorer/gallery/components/source-stars-badge', () => ({
  SourceStarsBadge: (props: { size?: string; favoriteCount?: number }) => (
    <div data-testid="stars" data-size={props.size ?? 'default'}>
      {props.favoriteCount}
    </div>
  ),
}))

vi.mock('@ks/module-explorer/gallery/components/source-comments-badge', () => ({
  SourceCommentsBadge: () => <div data-testid="comments" />,
}))

function render(ui: React.ReactElement) {
  return rtlRender(
    <GalleryViewerProvider viewer={ANONYMOUS_VIEWER}>
      <GalleryHostProvider host={STILLER_GASTGEBER}>{ui}</GalleryHostProvider>
    </GalleryViewerProvider>,
  )
}

const massnahme = {
  id: 'doc-7',
  fileId: 'file-7',
  title: 'Photovoltaik auf allen Schuldaechern',
  fileName: 'pv-schulen.md',
  category: 'Energie',
  massnahme_nr: '42',
  prioritaets_index: 3.4,
  lv_bewertung: 'in_umsetzung',
  favoriteCount: 5,
} as DocCardMeta

const STATUS_TITLE = 'story.beleg.status.umsetzung'

describe('ClimateActionCard: kompakte Kachel', () => {
  afterEach(() => cleanup())

  it('zeigt Titel, Status-Punkt mit Tooltip und Sterne — keine Nr., Prio, Kategorie, Kommentare', () => {
    render(<DocumentCard doc={massnahme} libraryId="lib-1" libraryDetailViewType="climateAction" cardDensity="compact" />)

    expect(screen.getByText('Photovoltaik auf allen Schuldaechern')).toBeTruthy()
    const punkt = screen.getByTitle(STATUS_TITLE)
    expect(punkt.getAttribute('aria-label')).toBe(STATUS_TITLE)
    // Der Status steht nur im Tooltip, nicht als sichtbarer Text.
    expect(screen.queryByText(STATUS_TITLE)).toBeNull()

    expect(screen.queryByText(/Nr\. 42/)).toBeNull()
    expect(screen.queryByText(/Prio/)).toBeNull()
    expect(screen.queryByText('Energie')).toBeNull()
    expect(screen.queryByTestId('comments')).toBeNull()

    const sterne = screen.getByTestId('stars')
    expect(sterne.getAttribute('data-size')).toBe('compact')
    expect(sterne.textContent).toBe('5')
  })

  it('zeigt einen unbekannten Status roh im Tooltip statt ihn zu raten', () => {
    render(
      <DocumentCard
        doc={{ ...massnahme, lv_bewertung: 'irgendwas_neues' } as DocCardMeta}
        libraryId="lib-1"
        libraryDetailViewType="climateAction"
        cardDensity="compact"
      />,
    )
    expect(screen.getByTitle('irgendwas_neues')).toBeTruthy()
  })

  it('laesst den Status-Punkt weg, wenn die Massnahme keinen Status hat', () => {
    render(
      <DocumentCard
        doc={{ ...massnahme, lv_bewertung: undefined } as DocCardMeta}
        libraryId="lib-1"
        libraryDetailViewType="climateAction"
        cardDensity="compact"
      />,
    )
    expect(screen.queryByTitle(STATUS_TITLE)).toBeNull()
    expect(screen.getByTestId('stars')).toBeTruthy()
  })
})

describe('ClimateActionCard: komfortable Form bleibt unveraendert', () => {
  afterEach(() => cleanup())

  it.each([
    ['ohne Angabe', undefined],
    ['explizit comfortable', 'comfortable' as const],
  ])('zeigt Kategorie, Titel, Nr., Prio, Status-Text, Sterne und Kommentare (%s)', (_name, dichte) => {
    render(
      <DocumentCard doc={massnahme} libraryId="lib-1" libraryDetailViewType="climateAction" cardDensity={dichte} />,
    )

    expect(screen.getByText('Energie')).toBeTruthy()
    expect(screen.getByText('Photovoltaik auf allen Schuldaechern')).toBeTruthy()
    expect(screen.getByText('Nr. 42')).toBeTruthy()
    expect(screen.getByText(/Prio 3\.4/)).toBeTruthy()
    expect(screen.getByText(STATUS_TITLE)).toBeTruthy()
    expect(screen.getByTestId('stars').getAttribute('data-size')).toBe('default')
    expect(screen.getByTestId('comments')).toBeTruthy()
  })
})
