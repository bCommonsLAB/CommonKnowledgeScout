// @vitest-environment jsdom

/**
 * Belegliste (D3, Plan `story-dreiteilung-fragenchronik`): aus den Referenzen
 * einer Antwort wird je Dokument ein Beleg mit Nummern, Titel, Kurztext;
 * Plakette und Kennzeile kommen aus der Konfig des Detailansichtstyps und
 * fallen weg, wenn der Typ keine hat. „Original ansehen" oeffnet ueber die
 * Adressierung der Galerie.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DocCardMeta, DocReference } from '@ks/contracts'
import { GalleryNavigationProvider, type GalleryNavigation } from '@ks/module-explorer/react'
import { BelegListe } from '../../../../packages/module-explorer/src/gallery/components/beleg-liste/beleg-liste'
import {
  belegeAusReferenzen,
  belegKonfig,
  ersteSeite,
  kennzeileFuer,
  plaketteFuer,
} from '../../../../packages/module-explorer/src/gallery/components/beleg-liste/helpers'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
    locale: 'de',
  }),
}))

const references: DocReference[] = [
  { number: 1, fileId: 'f-a', fileName: 'Radwege.md', description: 'Markdown-Body: Radwege ausbauen', detailViewType: 'climateAction' },
  { number: 2, fileId: 'f-b', fileName: 'Heizen.md', description: 'Kapitel 2: Fernwaerme' },
  { number: 3, fileId: 'f-a', fileName: 'Radwege.md', description: 'Markdown-Body: Kosten' },
]
const docs: DocCardMeta[] = [
  {
    id: 'f-a', fileId: 'f-a', title: 'Radwege ausbauen',
    detailViewType: 'climateAction', lv_bewertung: 'in_umsetzung', massnahme_nr: '12', arbeitsgruppe: 'Mobilität', slug: 'radwege',
  },
]

afterEach(cleanup)

describe('belegeAusReferenzen', () => {
  it('ein Beleg je Dokument, Nummern gesammelt, Titel aus dem Dokument, Kurztext aus der ersten Referenz', () => {
    const belege = belegeAusReferenzen(references, docs)
    expect(belege.map((b) => [b.fileId, b.nummern, b.titel])).toEqual([
      ['f-a', [1, 3], 'Radwege ausbauen'],
      ['f-b', [2], 'Heizen.md'],
    ])
    expect(belege[0].kurztext).toBe('Markdown-Body: Radwege ausbauen')
    expect(belegeAusReferenzen([{ number: 1, fileId: 'f-a', description: '   ' }], docs)[0].kurztext).toBeUndefined()
    expect(belege[0].typ).toBe('climateAction')
  })

  it('ohne geladenes Dokument: Dateiname als Titel, Typ aus der Library-Konfig', () => {
    const [, b] = belegeAusReferenzen(references, docs, 'book')
    expect(b.titel).toBe('Heizen.md')
    expect(b.typ).toBe('book')
    expect(belegeAusReferenzen(references, [], 'kein-typ')[1].typ).toBeNull()
  })
})

describe('plaketteFuer / kennzeileFuer', () => {
  const konfig = belegKonfig('climateAction')

  it('ordnet bekannte Werte den vier Plaketten zu, zeigt unbekannte roh, laesst leere weg', () => {
    expect(plaketteFuer(konfig, docs[0])).toEqual({ art: 'plakette', plakette: 'umsetzung' })
    expect(plaketteFuer(konfig, { ...docs[0], lv_bewertung: 'vertieft_pruefen' })).toEqual({ art: 'plakette', plakette: 'pruefung' })
    expect(plaketteFuer(konfig, { ...docs[0], lv_bewertung: 'irgendwas' })).toEqual({ art: 'roh', wert: 'irgendwas' })
    expect(plaketteFuer(konfig, { ...docs[0], lv_bewertung: undefined })).toBeNull()
    expect(plaketteFuer(konfig, undefined)).toBeNull()
  })

  it('Typ ohne Status-Konfig hat keine Plakette; Kennzeile nimmt nur gefuellte Felder', () => {
    expect(plaketteFuer(belegKonfig('book'), { id: 'x', lv_bewertung: 'in_umsetzung' })).toBeNull()
    expect(kennzeileFuer(konfig, docs[0])).toEqual(['12', 'Mobilität'])
    expect(kennzeileFuer(belegKonfig('book'), { id: 'x', authors: ['A', 'B'], year: 2024 })).toEqual(['A, B', '2024'])
    expect(kennzeileFuer(belegKonfig('testimonial'), docs[0])).toEqual([])
  })
})

describe('BelegListe', () => {
  function renderListe(props: Partial<React.ComponentProps<typeof BelegListe>> = {}) {
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
    const onSchliessen = vi.fn()
    const onOpenDocument = vi.fn()
    render(
      <GalleryNavigationProvider navigation={navigation}>
        <BelegListe
          references={references}
          usedDocs={docs}
          unusedDocs={[{ id: 'f-c', title: 'Noch ein Dokument' }]}
          libraryId="lib"
          katalogAnzahl={42}
          onOpenDocument={onOpenDocument}
          onSchliessen={onSchliessen}
          {...props}
        />
      </GalleryNavigationProvider>,
    )
    return { openDocument, onSchliessen, onOpenDocument }
  }

  it('zeigt je Dokument eine Karte mit Nummern, Plakette, Kennzeile und Kurztext', () => {
    renderListe()
    expect(screen.getByText('story.beleg.count.many:2')).toBeTruthy()
    expect(screen.getByText('Radwege ausbauen')).toBeTruthy()
    expect(screen.getByText('story.beleg.status.umsetzung')).toBeTruthy()
    expect(screen.getByText('12 · Mobilität')).toBeTruthy()
    expect(screen.getByText('Markdown-Body: Radwege ausbauen')).toBeTruthy()
    // Zweites Dokument ohne Bestand: keine Plakette, keine Kennzeile — Titel und Kurztext bleiben.
    expect(screen.getByText('Heizen.md')).toBeTruthy()
    expect(screen.getByText('Kapitel 2: Fernwaerme')).toBeTruthy()
    expect(screen.getAllByText('story.beleg.status.umsetzung')).toHaveLength(1)
    // D12e: jede Marke der Antwort findet ihre Karte, auch die zweite desselben Dokuments.
    for (const r of references) expect(document.getElementById(`beleg-${r.number}`)).not.toBeNull()
  })

  it('„Original ansehen" oeffnet ueber die Adressierung (Slug), sonst ueber den Rueckfall', () => {
    const { openDocument, onOpenDocument } = renderListe()
    const knoepfe = screen.getAllByRole('button', { name: /story.beleg.original/ })
    fireEvent.click(knoepfe[0])
    expect(openDocument).toHaveBeenCalledWith('radwege')
    // Zweiter Beleg hat kein Dokument im Bestand → Ereignis statt Adresse.
    const ereignisse: string[] = []
    const handler = (e: Event) => ereignisse.push((e as CustomEvent<{ fileId: string }>).detail.fileId)
    window.addEventListener('open-document-detail', handler)
    fireEvent.click(knoepfe[1])
    window.removeEventListener('open-document-detail', handler)
    expect(ereignisse).toEqual(['f-b'])
    expect(onOpenDocument).not.toHaveBeenCalled()
  })

  it('Schliessen und der Weg in den Katalog rufen dieselbe Rueckkehr auf', () => {
    const { onSchliessen } = renderListe()
    fireEvent.click(screen.getByRole('button', { name: 'story.beleg.close' }))
    fireEvent.click(screen.getByRole('button', { name: 'story.beleg.catalog:42' }))
    expect(onSchliessen).toHaveBeenCalledTimes(2)
  })

  it('ohne Belege eine sichtbare Meldung, weitere Dokumente zugeklappt', () => {
    renderListe({ references: [], usedDocs: [] })
    expect(screen.getByText('story.beleg.none')).toBeTruthy()
    const weitere = screen.getByRole('button', { name: 'story.beleg.moreFound:1' })
    expect(weitere.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(weitere)
    expect(weitere.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Noch ein Dokument')).toBeTruthy()
  })
})

describe('BelegListe mit Textstellen (D7)', () => {
  const mitSeiten: DocReference[] = [
    {
      number: 1, fileId: 'f-a', fileName: 'Radwege.md', description: 'Radwege', detailViewType: 'climateAction',
      passages: [
        { chunkIndex: 4, page: 3, excerpt: 'Der Ausbau der Radwege beginnt 2027.' },
        { chunkIndex: 9, page: 7, excerpt: 'Kosten: 1,2 Mio.' },
      ],
    },
    { number: 2, fileId: 'f-b', fileName: 'Heizen.md', description: 'Fernwaerme', passages: [{ chunkIndex: 1, excerpt: 'Ohne Seite.' }] },
  ]

  function renderListe() {
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
    render(
      <GalleryNavigationProvider navigation={navigation}>
        <BelegListe references={mitSeiten} usedDocs={docs} unusedDocs={[]} libraryId="lib" katalogAnzahl={1} onSchliessen={vi.fn()} />
      </GalleryNavigationProvider>,
    )
    return { openDocument }
  }

  it('sammelt die Textstellen je Dokument; erste Seite fuer „Original ansehen"', () => {
    const belege = belegeAusReferenzen(mitSeiten, docs)
    expect(belege[0].passages.map((p) => p.page)).toEqual([3, 7])
    expect(ersteSeite(belege[0])).toBe(3)
    expect(ersteSeite(belege[1])).toBeUndefined()
    expect(belegeAusReferenzen(references, docs)[0].passages).toEqual([])
  })

  it('Zitatmarke statt Zahl, Anker beleg-<n>, Textstellen mit Seite als Knopf', () => {
    renderListe()
    expect(screen.getByText('①')).toBeTruthy()
    expect(document.getElementById('beleg-1')?.getAttribute('data-beleg')).toBe('f-a')
    expect(document.getElementById('beleg-2')).toBeTruthy()
    expect(screen.getByText('Der Ausbau der Radwege beginnt 2027.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'story.beleg.openAtPage:7' })).toBeTruthy()
    // Ohne Seite: Zitat, aber kein Seitenknopf
    expect(screen.getByText('Ohne Seite.')).toBeTruthy()
    expect(screen.queryAllByRole('button', { name: /openAtPage/ })).toHaveLength(2)
  })

  it('Seitenknopf oeffnet an der Seite, „Original ansehen" an der ersten Seite, ohne Seite am Anfang', () => {
    const { openDocument } = renderListe()
    fireEvent.click(screen.getByRole('button', { name: 'story.beleg.openAtPage:7' }))
    expect(openDocument).toHaveBeenLastCalledWith('radwege', { page: 7 })
    const original = screen.getAllByRole('button', { name: /story.beleg.original/ })
    fireEvent.click(original[0])
    expect(openDocument).toHaveBeenLastCalledWith('radwege', { page: 3 })
  })
})
