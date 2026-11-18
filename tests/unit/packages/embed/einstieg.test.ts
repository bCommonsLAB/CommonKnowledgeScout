/**
 * WE0 (Plan `startseite-als-embed`): Der Einstieg wird der Anfangszustand der
 * Adressierung im Speicher — oder ein Fehler im Rahmen, wenn er nicht zur
 * Ansicht passt. Nichts wird still weggelassen.
 */

import { describe, it, expect } from 'vitest'
import { einstiegAufbauen } from '../../../../packages/embed/src/einstieg'
import type { KsEinstieg } from '../../../../packages/embed/src/typen'

describe('einstiegAufbauen', () => {
  it('ohne Einstieg: wie bisher (Story startet im Story-Modus)', () => {
    expect(einstiegAufbauen(undefined, 'gallery')).toEqual({ initialParams: undefined, frage: undefined })
    expect(einstiegAufbauen(undefined, 'story')).toEqual({ initialParams: 'mode=story', frage: undefined })
    expect(einstiegAufbauen({}, 'gallery')).toEqual({ initialParams: undefined, frage: undefined })
  })

  it('Galerie: Dokument, Seite und Liste werden Adress-Parameter', () => {
    const aufbau = einstiegAufbauen({ dokument: 'karte-1', seitenzahl: 3, liste: { nurMitStern: true, sortierung: 'stars' } }, 'gallery')
    expect(aufbau).toEqual({ initialParams: 'doc=karte-1&page=3&starred=1&sort=stars', frage: undefined })
  })

  it('Story: die Frage geht an die Auswahl, nicht in die Adresse', () => {
    expect(einstiegAufbauen({ frage: ' q-42 ' }, 'story')).toEqual({ initialParams: 'mode=story', frage: 'q-42' })
  })

  it.each([
    ['ein Dokument im Story-Modus', { dokument: 'karte-1' }, 'story', /view="gallery"/],
    ['eine Liste im Story-Modus', { liste: { sortierung: 'stars' } }, 'story', /view="gallery"/],
    ['eine Frage in der Galerie', { frage: 'q-42' }, 'gallery', /view="story"/],
    ['eine Seite ohne Dokument', { seitenzahl: 2 }, 'gallery', /braucht start.dokument/],
    ['eine Seite 0', { dokument: 'a', seitenzahl: 0 }, 'gallery', /keine Seite/],
    ['ein leeres Dokument', { dokument: ' ' }, 'gallery', /Slug/],
    ['ein unbekanntes Feld', { doc: 'karte-1' }, 'gallery', /start.doc gibt es nicht/],
    ['ein unbekanntes Listen-Feld', { liste: { favoriten: true } }, 'gallery', /start.liste.favoriten gibt es nicht/],
    ['eine unbekannte Sortierung', { liste: { sortierung: 'datum' } }, 'gallery', /gibt es nicht/],
  ])('meldet %s', (_fall, start, view, meldung) => {
    const aufbau = einstiegAufbauen(start as unknown as KsEinstieg, view as 'gallery' | 'story')
    expect('fehler' in aufbau && aufbau.fehler).toMatch(meldung)
  })
})
