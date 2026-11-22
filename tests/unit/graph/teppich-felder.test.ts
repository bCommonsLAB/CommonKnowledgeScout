// @vitest-environment node
/**
 * Felder des Teppichs am Meta-Dokument (Plan `teppich-der-dokumente`, T1):
 * Zeit, Jahr, Inhalt/Website, Eingabe der Lage-Regel und Punkt der Lese-Route.
 */
import { describe, it, expect } from 'vitest'
import { istTeppichInhalt, jahrFuerAnzeige, leseTeppichEingabe, leseTeppichPunkt, zeitAus } from '@/lib/graph/teppich-felder'

describe('Teppich-Felder: Zeit und Jahr', () => {
  it('nimmt zuerst das Datum, dann die Mitte des Jahres, sonst nichts', () => {
    expect(zeitAus({ date: '2024-03-01', year: 2020 })).toBe(Date.parse('2024-03-01'))
    expect(zeitAus({ docMetaJson: { date: '2023-01-15' } })).toBe(Date.parse('2023-01-15'))
    expect(zeitAus({ date: 'kein Datum', year: 2021 })).toBe(Date.UTC(2021, 6, 1))
    expect(zeitAus({ docMetaJson: { year: '2019' } })).toBe(Date.UTC(2019, 6, 1))
    expect(zeitAus({ year: 12 })).toBeNull()
    expect(zeitAus({})).toBeNull()
  })

  it('zeigt das Jahr, sonst das Jahr des Datums', () => {
    expect(jahrFuerAnzeige({ year: 2020, date: '2024-01-01' })).toBe(2020)
    expect(jahrFuerAnzeige({ date: '2024-05-01' })).toBe(2024)
    expect(jahrFuerAnzeige({})).toBeNull()
  })
})

describe('Teppich-Felder: Inhalt', () => {
  it('Seiten der Website gehoeren nicht auf den Teppich, egal wo der Typ steht', () => {
    expect(istTeppichInhalt({ detailViewType: 'website' })).toBe(false)
    expect(istTeppichInhalt({ docMetaJson: { detailViewType: 'website' } })).toBe(false)
    expect(istTeppichInhalt({ detailViewType: 'session' })).toBe(true)
  })
})

describe('Teppich-Felder: Eingabe der Lage-Regel', () => {
  it('liest Nachbarn, Umfang und fruehere Lage', () => {
    const e = leseTeppichEingabe({
      fileId: 'f1', chunkCount: 12, year: 2022,
      docMetaJson: {
        similarity_neighbors: [{ fileId: 'f2', weight: 0.8 }, { fileId: '', weight: 1 }, { weight: 0.5 }],
        teppich_x: 0.3, teppich_y: 0.6,
      },
    })
    expect(e).toEqual({ fileId: 'f1', zeit: Date.UTC(2022, 6, 1), nachbarn: [{ fileId: 'f2', weight: 0.8 }], umfang: 12, vorher: { x: 0.3, y: 0.6 } })
  })

  it('ohne Kennung keine Eingabe; ohne Umfang oder Lage bleiben die Felder leer', () => {
    expect(leseTeppichEingabe({ chunkCount: 3 })).toBeNull()
    expect(leseTeppichEingabe({ fileId: 'f', chunkCount: -1 })).toMatchObject({ umfang: null, vorher: null, nachbarn: [] })
  })
})

describe('Teppich-Felder: Punkt der Lese-Route', () => {
  it('liefert Lage, Gewicht, Jahr und den kuerzesten Titel', () => {
    const p = leseTeppichPunkt({
      fileId: 'f1', shortTitle: 'Kurz', title: 'Lang', year: 2021,
      docMetaJson: { teppich_x: 0.1, teppich_y: 0.2, teppich_gewicht: 0.5 },
    })
    expect(p).toEqual({ fileId: 'f1', x: 0.1, y: 0.2, gewicht: 0.5, jahr: 2021, titel: 'Kurz' })
  })

  it('kuerzt lange Titel und meldet fehlende Lage als null', () => {
    const p = leseTeppichPunkt({ fileId: 'f', title: 'x'.repeat(200), docMetaJson: { teppich_x: 0, teppich_y: 0 } })
    expect(p?.titel.length).toBe(80)
    expect(p?.gewicht).toBeNull()
    expect(leseTeppichPunkt({ fileId: 'f', docMetaJson: { teppich_x: 0.5 } })).toBeNull()
  })
})
