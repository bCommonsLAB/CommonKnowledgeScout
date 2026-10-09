import { describe, expect, it } from 'vitest'
import { parseLanguagesText, readLanguageList } from '@/lib/external-jobs/audio-languages'

describe('parseLanguagesText', () => {
  it('trennt an Komma, Leerzeichen, Semikolon; klein, ohne Dubletten, Reihenfolge erhalten', () => {
    expect(parseLanguagesText('DE, it;de\nen')).toEqual({ codes: ['de', 'it', 'en'], invalid: [] })
  })

  it('meldet Nicht-Codes statt sie still zu verwerfen', () => {
    expect(parseLanguagesText('de, Deutsch, i')).toEqual({ codes: ['de'], invalid: ['Deutsch', 'i'] })
  })

  it('leer ergibt leer', () => {
    expect(parseLanguagesText('  ')).toEqual({ codes: [], invalid: [] })
  })
})

describe('readLanguageList', () => {
  it('liest nur Strings aus einer Liste; kein Array ergibt leer', () => {
    expect(readLanguageList(['de', 3, 'it'])).toEqual({ codes: ['de', 'it'], invalid: [] })
    expect(readLanguageList('de')).toEqual({ codes: [], invalid: [] })
  })
})
