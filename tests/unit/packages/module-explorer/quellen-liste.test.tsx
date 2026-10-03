// @vitest-environment jsdom

/**
 * `QuellenListe` (D12q): der gefilterte Bestand als dieselbe kompakte
 * Kartenliste wie die Belege — ohne Marke und Anker, mit Zaehler,
 * Filter-Slot, Zuklappen, „Original ansehen" und Nachladen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DocCardMeta } from '@ks/contracts'
import { GalleryNavigationProvider, type GalleryNavigation } from '@ks/module-explorer/react'
import { QuellenListe } from '../../../../packages/module-explorer/src/gallery/components/beleg-liste/quellen-liste'
import { belegAusDokument } from '../../../../packages/module-explorer/src/gallery/components/beleg-liste/helpers'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join(',')}` : key),
    locale: 'de',
  }),
}))

afterEach(cleanup)

const docs: DocCardMeta[] = [
  { id: 'f-a', fileId: 'f-a', title: 'Radwege ausbauen', detailViewType: 'climateAction', lv_bewertung: 'in_umsetzung', massnahme_nr: '12', slug: 'radwege' },
  { id: 'f-b', fileName: 'Heizen.md' },
]

describe('belegAusDokument', () => {
  it('Beleg ohne Marke: Titel vor Kurztitel vor Dateiname vor Kennung, Typ vom Dokument oder der Library', () => {
    expect(belegAusDokument(docs[0])).toMatchObject({ fileId: 'f-a', titel: 'Radwege ausbauen', typ: 'climateAction', passages: [] })
    expect(belegAusDokument(docs[0]).nummer).toBeUndefined()
    expect(belegAusDokument(docs[1], 'book')).toMatchObject({ fileId: 'f-b', titel: 'Heizen.md', typ: 'book' })
    expect(belegAusDokument({ id: 'x' }).titel).toBe('x')
  })
})

describe('QuellenListe', () => {
  function montieren(props: Partial<React.ComponentProps<typeof QuellenListe>> = {}) {
    const openDocument = vi.fn()
    const navigation: GalleryNavigation = {
      openDocument,
      closeDocument: vi.fn(),
      documentShareUrl: () => '',
      params: new URLSearchParams(),
      replaceParams: vi.fn(),
      pushParams: vi.fn(),
      applyModeParams: vi.fn(),
    }
    const onLoadMore = vi.fn()
    const onZuklappen = vi.fn()
    render(
      <GalleryNavigationProvider navigation={navigation}>
        <QuellenListe
          docs={docs}
          anzahl={120}
          loading={false}
          error={null}
          hasMore={true}
          isLoadingMore={false}
          onLoadMore={onLoadMore}
          libraryId="lib"
          filterAnzeige={<span data-testid="chips">gefiltert</span>}
          onZuklappen={onZuklappen}
          {...props}
        />
      </GalleryNavigationProvider>,
    )
    return { openDocument, onLoadMore, onZuklappen }
  }

  it('Kopf mit Zaehler und Filter-Slot, je Dokument eine kompakte Karte ohne Marke und Anker, Plakette aus der Konfig', () => {
    montieren()
    expect(screen.getByText('gallery.tocReferences')).toBeTruthy()
    expect(screen.getByText('120 gallery.sources')).toBeTruthy()
    expect(screen.getByTestId('chips')).toBeTruthy()
    expect(screen.getByText('Radwege ausbauen')).toBeTruthy()
    expect(screen.getByText('Heizen.md')).toBeTruthy()
    expect(screen.getByText('story.beleg.status.umsetzung')).toBeTruthy()
    expect(document.querySelector('li[id^="beleg-"]')).toBeNull()
    expect(screen.queryByLabelText(/story.beleg.citedAs/)).toBeNull()
    // Ohne Textstellen und Kurztext kein Aufklapper.
    expect(screen.queryByRole('button', { name: 'story.beleg.more' })).toBeNull()
  })

  it('„Original ansehen" oeffnet ueber die Adressierung; Zuklappen und Nachladen rufen ihre Wege', () => {
    const { openDocument, onLoadMore, onZuklappen } = montieren()
    fireEvent.click(screen.getAllByRole('button', { name: /story.beleg.original/ })[0])
    expect(openDocument).toHaveBeenCalledWith('radwege')
    fireEvent.click(screen.getByRole('button', { name: 'story.beleg.close' }))
    expect(onZuklappen).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'story.quellen.more' }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('leer, ladend und Fehler sind sichtbar; ohne weitere Seiten kein Nachladen', () => {
    montieren({ docs: [], hasMore: false })
    expect(screen.getByText('story.quellen.none')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'story.quellen.more' })).toBeNull()
    cleanup()
    montieren({ loading: true })
    expect(screen.getByText('gallery.loading')).toBeTruthy()
    cleanup()
    montieren({ error: 'Server weg' })
    expect(screen.getByText('Server weg')).toBeTruthy()
  })
})
