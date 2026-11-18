/**
 * WE0 (Plan `startseite-als-embed`): Ziele aus einer KnowledgeScout-Komponente
 * reisen als `ks-`-Parameter durch die Container-Anwendung und kommen als
 * Einstieg der naechsten Komponente wieder an. Fremde Parameter der
 * Container-Seite bleiben unberuehrt; ungueltige `ks-`-Werte werden gemeldet,
 * nicht still uebernommen.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  ksEinstiegAusParametern,
  ksSeiteAusParametern,
  ksZielAlsParameter,
} from '../../../../packages/embed/src/ziel-parameter'
import type { KsZiel } from '../../../../packages/embed/src/typen'

afterEach(() => {
  vi.restoreAllMocks()
})

/** Ziel → Adresse der Container-Seite → Einstieg. */
function hinUndZurueck(ziel: KsZiel) {
  return ksEinstiegAusParametern(new URLSearchParams(ksZielAlsParameter(ziel)))
}

describe('ksZielAlsParameter', () => {
  it('Galerie ohne Liste: keine Parameter', () => {
    expect(ksZielAlsParameter({ art: 'galerie' })).toEqual({})
  })

  it('Galerie mit Rangliste (Banner „mehr Inhalte" bei banner_sort stars)', () => {
    expect(ksZielAlsParameter({ art: 'galerie', liste: { nurMitStern: true, sortierung: 'stars' } })).toEqual({
      'ks-starred': '1',
      'ks-sort': 'stars',
    })
  })

  it('Dokument mit Seite und Liste', () => {
    expect(ksZielAlsParameter({ art: 'dokument', slug: 'karte-1', seitenzahl: 3, liste: { sortierung: 'rating' } })).toEqual({
      'ks-doc': 'karte-1',
      'ks-page': '3',
      'ks-sort': 'rating',
    })
  })

  it('Story mit und ohne Frage, Website-Seite', () => {
    expect(ksZielAlsParameter({ art: 'story' })).toEqual({})
    expect(ksZielAlsParameter({ art: 'story', frage: 'q-42' })).toEqual({ 'ks-q': 'q-42' })
    expect(ksZielAlsParameter({ art: 'seite', seite: 'impressum' })).toEqual({ 'ks-site': 'impressum' })
  })

  it.each([
    ['ein Dokument ohne Slug', { art: 'dokument', slug: ' ' }, /slug/],
    ['eine Seite 0', { art: 'dokument', slug: 'a', seitenzahl: 0 }, /keine Seite/],
    ['eine unbekannte Sortierung', { art: 'galerie', liste: { sortierung: 'datum' } }, /gibt es nicht/],
    ['eine leere Website-Seite', { art: 'seite', seite: '' }, /seite/],
    ['eine unbekannte Art', { art: 'karte' }, /Unbekanntes Ziel/],
  ])('wirft bei %s', (_fall, ziel, meldung) => {
    expect(() => ksZielAlsParameter(ziel as unknown as KsZiel)).toThrow(meldung)
  })
})

describe('ksEinstiegAusParametern', () => {
  it('kommt fuer Dokument, Liste und Frage wieder an', () => {
    expect(hinUndZurueck({ art: 'dokument', slug: 'karte-1', seitenzahl: 3, liste: { nurMitStern: true, sortierung: 'stars' } })).toEqual({
      dokument: 'karte-1',
      seitenzahl: 3,
      liste: { nurMitStern: true, sortierung: 'stars' },
    })
    expect(hinUndZurueck({ art: 'story', frage: 'q-42' })).toEqual({ frage: 'q-42' })
    expect(hinUndZurueck({ art: 'galerie' })).toEqual({})
  })

  it('liest nur ks-Parameter; die eigenen der Container-Seite bleiben unberuehrt', () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(ksEinstiegAusParametern(new URLSearchParams('view=v_index&doc=fremd&ks-doc=karte-1'))).toEqual({ dokument: 'karte-1' })
    expect(fehler).not.toHaveBeenCalled()
  })

  it('nimmt die searchParams einer Next-Seite (Objekt, auch mit Listen)', () => {
    expect(ksEinstiegAusParametern({ 'ks-doc': 'karte-1', 'ks-page': ['2'], view: ['a', 'b'] })).toEqual({ dokument: 'karte-1', seitenzahl: 2 })
  })

  it.each([
    ['eine Seite, die keine Zahl ist', 'ks-doc=a&ks-page=zwei', { dokument: 'a' }],
    ['eine Seite ohne Dokument', 'ks-page=2', {}],
    ['einen falschen Stern-Wert', 'ks-starred=ja', {}],
    ['eine unbekannte Sortierung', 'ks-sort=datum', {}],
    ['ein leeres Dokument', 'ks-doc=', {}],
    ['ein doppeltes Dokument', 'ks-doc=a&ks-doc=b', {}],
  ])('meldet %s und uebernimmt den Wert nicht', (_fall, adresse, erwartet) => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(ksEinstiegAusParametern(new URLSearchParams(adresse))).toEqual(erwartet)
    expect(fehler).toHaveBeenCalledTimes(1)
  })
})

describe('ksSeiteAusParametern', () => {
  it('liest die Website-Seite und sonst nichts', () => {
    expect(ksSeiteAusParametern(new URLSearchParams(ksZielAlsParameter({ art: 'seite', seite: 'kontakt' })))).toBe('kontakt')
    expect(ksSeiteAusParametern(new URLSearchParams('site=fremd'))).toBeUndefined()
  })
})
