/**
 * Die eigene Perspektive im Embed (`enablePerspective`, 09.10.2026): ohne Wahl
 * gilt die Konfig der Library wie bisher; Gespeichertes wird geprueft, nicht
 * blind uebernommen; Sprache und Modell stehen fest.
 */
import { describe, it, expect } from 'vitest'
import { ausGespeichert, perspektiveFuer, wahlFuerDialog } from '../../../../packages/embed/src/embed-perspektive'

const chat = { character: ['ecology' as const], socialContext: 'general' as const, genderInclusive: false }

describe('perspektiveFuer', () => {
  it('ohne eigene Wahl: die Konfig der Library, Sprache = locale, Zugang leer (Server nimmt den der Library)', () => {
    expect(perspektiveFuer(chat, 'it', 'm1', null)).toEqual({
      targetLanguage: 'it', character: ['ecology'], accessPerspective: [], socialContext: 'general', genderInclusive: false, llmModel: 'm1',
    })
  })

  it('mit eigener Wahl: Interessen, Zugang, Sprachstil von der Besucherin; Sprache und Modell bleiben', () => {
    const eigene = { character: ['business' as const], accessPerspective: ['learning' as const], socialContext: 'youth' as const }
    expect(perspektiveFuer(chat, 'de', 'm1', eigene)).toMatchObject({ targetLanguage: 'de', llmModel: 'm1', character: ['business'], accessPerspective: ['learning'], socialContext: 'youth' })
  })

  it('ohne Konfig: „nicht festgelegt" und gendergerecht', () => {
    expect(perspektiveFuer(undefined, 'en', '', null)).toMatchObject({ character: [], socialContext: 'undefined', genderInclusive: true })
  })
})

describe('wahlFuerDialog', () => {
  it('leere Listen heissen im Dialog „nicht festgelegt"', () => {
    const w = wahlFuerDialog(perspektiveFuer(undefined, 'en', 'm1', null))
    expect(w.character).toEqual(['undefined'])
    expect(w.accessPerspective).toEqual(['undefined'])
  })
})

describe('ausGespeichert', () => {
  it('nimmt einen gueltigen Wert', () => {
    const wert = { character: ['ecology'], accessPerspective: ['insight'], socialContext: 'youth' }
    expect(ausGespeichert(wert)).toEqual(wert)
  })

  it('verwirft Unbekanntes, Leeres und Fremdes', () => {
    expect(ausGespeichert({ character: ['erfunden'], accessPerspective: ['insight'], socialContext: 'youth' })).toBeNull()
    expect(ausGespeichert({ character: [], accessPerspective: ['insight'], socialContext: 'youth' })).toBeNull()
    expect(ausGespeichert({ character: ['ecology'], accessPerspective: ['insight'], socialContext: 'laut' })).toBeNull()
    expect(ausGespeichert('text')).toBeNull()
    expect(ausGespeichert(null)).toBeNull()
  })
})
