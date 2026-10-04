/**
 * Kennung der Auswahl (D2): was in die Adresse gehoert und was eine von
 * aussen kommende Kennung an der Auswahl aendert. Das Paket kennt keine URL —
 * diese Regeln sind alles, was die App-Bruecke braucht.
 */
import { describe, it, expect } from 'vitest'
import { auswahlAusKennung, auswahlZuKennung, istNachtrag, STORY_UEBERSICHT } from '@ks/module-story/react'

describe('auswahlZuKennung', () => {
  it('nur eine gespeicherte Konversation hat eine Kennung', () => {
    expect(auswahlZuKennung({ art: 'konversation', queryId: 'q1' })).toBe('q1')
    expect(auswahlZuKennung({ art: 'konversation', frageId: 'lokal' })).toBeNull()
    expect(auswahlZuKennung({ art: 'thema', themaId: 'verkehr' })).toBeNull()
    expect(auswahlZuKennung(STORY_UEBERSICHT)).toBeNull()
  })
})

describe('auswahlAusKennung', () => {
  it('Kennung von aussen waehlt die Konversation — ausser sie ist schon gewaehlt', () => {
    expect(auswahlAusKennung('q1', STORY_UEBERSICHT)).toEqual({ art: 'konversation', queryId: 'q1' })
    expect(auswahlAusKennung('q1', { art: 'konversation', queryId: 'q0', themaId: 'x' })).toEqual({ art: 'konversation', queryId: 'q1' })
    expect(auswahlAusKennung('q1', { art: 'konversation', queryId: 'q1', themaId: 'x' })).toBeNull()
  })

  it('ohne Kennung gilt die Uebersicht — Thema und laufende Frage bleiben', () => {
    expect(auswahlAusKennung(null, { art: 'konversation', queryId: 'q1' })).toEqual(STORY_UEBERSICHT)
    expect(auswahlAusKennung(null, { art: 'thema', themaId: 'verkehr' })).toBeNull()
    expect(auswahlAusKennung(null, { art: 'konversation', frageId: 'lokal' })).toBeNull()
    expect(auswahlAusKennung(null, STORY_UEBERSICHT)).toBeNull()
  })
})

describe('istNachtrag', () => {
  it('dieselbe laufende Frage bekommt ihre gespeicherte Kennung', () => {
    expect(istNachtrag({ art: 'konversation', frageId: 'f' }, { art: 'konversation', frageId: 'f', queryId: 'q' })).toBe(true)
  })

  it('alles andere ist ein Wechsel', () => {
    expect(istNachtrag({ art: 'konversation', frageId: 'f' }, { art: 'konversation', frageId: 'g', queryId: 'q' })).toBe(false)
    expect(istNachtrag({ art: 'konversation', queryId: 'a' }, { art: 'konversation', queryId: 'b' })).toBe(false)
    expect(istNachtrag(STORY_UEBERSICHT, { art: 'konversation', queryId: 'q' })).toBe(false)
  })
})
