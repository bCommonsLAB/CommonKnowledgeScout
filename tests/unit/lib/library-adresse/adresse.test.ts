import { describe, it, expect } from 'vitest'
import { baueAdresse, baueBibliotheksKuerzel, istLibraryAdresse, zerlegeAdresse } from '@/lib/library-adresse/adresse'

describe('zerlegeAdresse', () => {
  it('zerlegt Slug, Pfad und Anker', () => {
    expect(zerlegeAdresse('@klima-archiv/Veranstaltungen/2026-09-25 Schulung/Flyer.pdf#Seite 2')).toEqual({
      slug: 'klima-archiv', pfad: 'Veranstaltungen/2026-09-25 Schulung/Flyer.pdf', anker: 'Seite 2',
    })
  })

  it('normalisiert Schraegstriche und laesst den Anker weg, wenn keiner da ist', () => {
    expect(zerlegeAdresse('@klima//a\\b.md/')).toEqual({ slug: 'klima', pfad: 'a/b.md', anker: null })
  })

  it('weist fehlendes @, fehlenden Pfad, ungueltigen Slug und .. ab', () => {
    expect(() => zerlegeAdresse('klima/a.md')).toThrow(/beginnt nicht mit @/)
    expect(() => zerlegeAdresse('@klima')).toThrow(/ohne Pfad/)
    expect(() => zerlegeAdresse('@klima/')).toThrow(/ohne Pfad/)
    expect(() => zerlegeAdresse('@Klima Archiv/a.md')).toThrow(/Ungueltiger Slug/)
    expect(() => zerlegeAdresse('@klima/../geheim.md')).toThrow(/\.\./)
  })
})

describe('baueAdresse / baueBibliotheksKuerzel / istLibraryAdresse', () => {
  it('baut die Form, die zerlegeAdresse wieder liest', () => {
    const adresse = baueAdresse({ slug: 'klima', pfad: '/Ordner/Datei.pdf', anker: 'Abschnitt' })
    expect(adresse).toBe('@klima/Ordner/Datei.pdf#Abschnitt')
    expect(zerlegeAdresse(adresse)).toEqual({ slug: 'klima', pfad: 'Ordner/Datei.pdf', anker: 'Abschnitt' })
  })

  it('kennt die Kurzform und erkennt Adressen am @', () => {
    expect(baueBibliotheksKuerzel('klima')).toBe('@klima')
    expect(istLibraryAdresse(' @klima/a.md')).toBe(true)
    expect(istLibraryAdresse('klima/a.md')).toBe(false)
  })
})
