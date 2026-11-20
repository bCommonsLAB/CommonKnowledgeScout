/**
 * Regeln der globalen Modell-Liste: Kennung, Anzeigename, Schalter, Reihenfolge.
 */
import { describe, it, expect } from 'vitest'
import { SprachmodellFehler, anbieterAus, anzeigeName, neueReihenfolge, pruefeSchalter } from '@/lib/llm-models/regeln'

const OK = { ok: true, at: '2026-11-20T14:00:00.000Z', ms: 900, antwort: 'OK' }
const KAPUTT = { ok: false, at: '2026-11-20T14:00:00.000Z', ms: 400, fehler: 'model not found' }

describe('anbieterAus', () => {
  it('liefert den Anbieter vor dem Schraegstrich', () => {
    expect(anbieterAus('deepseek/deepseek-v4.1-flash-1017')).toBe('deepseek')
    expect(anbieterAus('google/gemini-2.5-flash')).toBe('google')
  })
  it('weist Kennungen ohne Anbieter oder mit Leerzeichen ab', () => {
    expect(() => anbieterAus('gemini')).toThrow(SprachmodellFehler)
    expect(() => anbieterAus('google/ gemini')).toThrow(/Ungueltige Modell-Kennung/)
  })
})

describe('anzeigeName', () => {
  it('nimmt den Anbieter-Vorsatz weg', () => {
    expect(anzeigeName('DeepSeek: DeepSeek V4.1 Flash 1017')).toBe('DeepSeek V4.1 Flash 1017')
  })
  it('laesst Namen ohne Vorsatz stehen', () => {
    expect(anzeigeName('Gemini 2.5 Flash')).toBe('Gemini 2.5 Flash')
  })
})

describe('pruefeSchalter', () => {
  const alle = [
    { modelId: 'a/eins', isActive: true },
    { modelId: 'b/zwei', isActive: false, probe: OK },
    { modelId: 'c/drei', isActive: false, probe: KAPUTT },
  ]
  it('erlaubt aktiv schalten nach erfolgreicher Probe', () => {
    expect(() => pruefeSchalter(alle[1], true, alle)).not.toThrow()
  })
  it('verweigert aktiv schalten ohne oder nach gescheiterter Probe', () => {
    expect(() => pruefeSchalter(alle[2], true, alle)).toThrow(/erfolgreichen Probe/)
    expect(() => pruefeSchalter({ modelId: 'd/vier', isActive: false }, true, alle)).toThrow(/erfolgreichen Probe/)
  })
  it('verweigert das Abschalten des letzten aktiven Modells', () => {
    expect(() => pruefeSchalter(alle[0], false, alle)).toThrow(/Mindestens ein Modell/)
  })
  it('erlaubt Abschalten, wenn ein anderes aktiv bleibt', () => {
    const zwei = [...alle, { modelId: 'e/fuenf', isActive: true }]
    expect(() => pruefeSchalter(alle[0], false, zwei)).not.toThrow()
  })
})

describe('neueReihenfolge', () => {
  it('nummeriert lueckenlos ab 1', () => {
    const positionen = neueReihenfolge(['a/x', 'b/y', 'c/z'], ['c/z', 'a/x', 'b/y'])
    expect([...positionen]).toEqual([['c/z', 1], ['a/x', 2], ['b/y', 3]])
  })
  it('weist fehlende, fremde und doppelte Eintraege ab', () => {
    expect(() => neueReihenfolge(['a/x', 'b/y'], ['a/x'])).toThrow(/fehlt: b\/y/)
    expect(() => neueReihenfolge(['a/x'], ['a/x', 'q/q'])).toThrow(/unbekannt: q\/q/)
    expect(() => neueReihenfolge(['a/x', 'b/y'], ['a/x', 'a/x'])).toThrow(/doppelt/)
  })
})
