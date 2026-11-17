/**
 * Medienverzeichnis der Lesersicht: nur Bild-Fragmente des eigenen Twins, deren
 * Dateiname ein Feld des Dokuments nennt; kein Feld wird veraendert.
 */

import { describe, expect, it } from 'vitest'
import { genannteDateinamen, medienVerzeichnisAusFragmenten } from '@/lib/ingestion/medien-verzeichnis'
import type { MongoBinaryFragment } from '@/lib/repositories/shadow-twin-repo'

const BLOB = 'https://blob.example/lib/books/owner'

function bild(name: string, extra: Partial<MongoBinaryFragment> = {}): MongoBinaryFragment {
  return { name, url: `${BLOB}/${name}-hash.png`, kind: 'image', variant: 'original', ...extra }
}

describe('medienVerzeichnisAusFragmenten', () => {
  it('nimmt Vorder- und Rueckseite auf, die Vorlagenfelder als Dateinamen nennen', () => {
    const meta = { bild_vorderseite: 'karte_front.png', bild_rueckseite: 'karte_rueck.png', title: 'Karte' }
    const v = medienVerzeichnisAusFragmenten(meta, [bild('karte_rueck.png'), bild('karte_front.png')])
    expect(v.names).toEqual(['karte_front.png', 'karte_rueck.png'])
    expect(v.urls).toEqual([`${BLOB}/karte_front.png-hash.png`, `${BLOB}/karte_rueck.png-hash.png`])
  })

  it('laesst Fragmente weg, die kein Feld nennt — Extraktionsbilder blaehen nichts auf', () => {
    const meta = { bild_seite_1: 'page_001.jpeg' }
    const v = medienVerzeichnisAusFragmenten(meta, [bild('img-0.jpeg'), bild('page_001.jpeg'), bild('img-1.jpeg')])
    expect(v.names).toEqual(['page_001.jpeg'])
  })

  it('liest Dateinamen auch aus Listenfeldern', () => {
    const meta = { galerie: ['a.png', 'b.png'] }
    expect(medienVerzeichnisAusFragmenten(meta, [bild('b.png'), bild('a.png'), bild('c.png')]).names).toEqual(['a.png', 'b.png'])
  })

  it('nimmt nur Bilder mit Adresse, keine Vorschau-Variante, kein PDF, kein Audio', () => {
    const meta = { a: 'x.png', b: 'y.png', c: 'doc.pdf', d: 'ton.mp3', e: 'z.png' }
    const v = medienVerzeichnisAusFragmenten(meta, [
      bild('x.png', { variant: 'thumbnail' }),
      { name: 'y.png', kind: 'image' },
      { name: 'doc.pdf', url: `${BLOB}/doc.pdf`, kind: 'pdf', mimeType: 'application/pdf' },
      { name: 'ton.mp3', url: `${BLOB}/ton.mp3`, kind: 'audio' },
      bild('z.png'),
    ])
    expect(v.names).toEqual(['z.png'])
  })

  it('erkennt ein Bild auch ohne kind am MIME-Typ oder an der Endung', () => {
    const meta = { a: 'foto.webp', b: 'scan.bin' }
    const v = medienVerzeichnisAusFragmenten(meta, [
      { name: 'foto.webp', url: `${BLOB}/foto.webp` },
      { name: 'scan.bin', url: `${BLOB}/scan.bin`, mimeType: 'image/png' },
    ])
    expect(v.names).toEqual(['foto.webp', 'scan.bin'])
  })

  it('vergleicht den Dateinamen genau — kein Pfad, keine andere Schreibweise', () => {
    const meta = { a: 'ordner/karte.png', b: 'Karte.PNG' }
    expect(medienVerzeichnisAusFragmenten(meta, [bild('karte.png')]).names).toEqual([])
  })

  it('nimmt bei gleichem Namen das erste Fragment mit Adresse', () => {
    const meta = { a: 'k.png' }
    const v = medienVerzeichnisAusFragmenten(meta, [
      { name: 'k.png', kind: 'image' },
      bild('k.png', { url: `${BLOB}/erstes.png` }),
      bild('k.png', { url: `${BLOB}/zweites.png` }),
    ])
    expect(v).toEqual({ names: ['k.png'], urls: [`${BLOB}/erstes.png`] })
  })

  it('ist unabhaengig von der Reihenfolge der Fragmente', () => {
    const meta = { a: 'b.png', b: 'a.png' }
    const vor = medienVerzeichnisAusFragmenten(meta, [bild('a.png'), bild('b.png')])
    const rueck = medienVerzeichnisAusFragmenten(meta, [bild('b.png'), bild('a.png')])
    expect(vor).toEqual(rueck)
  })

  it('liefert ein leeres Verzeichnis ohne Fragmente oder ohne Nennung', () => {
    expect(medienVerzeichnisAusFragmenten({ a: 'x.png' }, [])).toEqual({ names: [], urls: [] })
    expect(medienVerzeichnisAusFragmenten({}, [bild('x.png')])).toEqual({ names: [], urls: [] })
  })
})

describe('genannteDateinamen', () => {
  it('uebergeht Adressen, leere Werte und alles, was kein Text ist', () => {
    const namen = genannteDateinamen({
      a: ' karte.png ',
      b: 'https://blob.example/x.png',
      c: '',
      d: 7,
      e: null,
      f: ['z.png', 3, 'HTTP://x/y.png'],
      g: { tief: 'nein.png' },
    })
    expect([...namen].sort()).toEqual(['karte.png', 'z.png'])
  })
})
