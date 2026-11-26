/**
 * `hero_tone` (26.11.2026) — Regel im Paket: gueltige Werte, Wurf bei
 * ungueltigem Wert, Hinweise bei wirkungslosem `light`, Bildposition rechts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { heroTon, heroTonGeprueft, heroTonHinweise, heroHellBildPosition, mapToWebsiteDetail } from '@ks/module-website'

afterEach(() => vi.restoreAllMocks())

describe('heroTon', () => {
  it('liest dark und light, fehlend bleibt undefined', () => {
    expect(heroTon('light')).toBe('light')
    expect(heroTon('dark')).toBe('dark')
    expect(heroTon(undefined)).toBeUndefined()
    expect(heroTon('')).toBeUndefined()
  })

  it('wirft bei unbekanntem Wert und falschem Typ', () => {
    expect(() => heroTon('hell')).toThrow(/hero_tone "hell" ist ungueltig \(erlaubt: dark, light\)/)
    expect(() => heroTon(true)).toThrow(/hero_tone "true"/)
  })

  it('Mapper: light wird gelesen, ungueltig laut gemeldet und zur Vorgabe', () => {
    expect(mapToWebsiteDetail({ docMetaJson: { title: 'Start', hero_tone: 'light' } }).heroTone).toBe('light')
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(heroTonGeprueft('hell')).toBeUndefined()
    expect(mapToWebsiteDetail({ docMetaJson: { title: 'Start', hero_tone: 'hell' } }).heroTone).toBeUndefined()
    expect(String(fehler.mock.calls[0][0])).toMatch(/hero_tone "hell"/)
  })
})

describe('heroTonHinweise', () => {
  it('light am Standard-Kopf mit Bild ist ohne Befund (hero_layout fehlend = overlay)', () => {
    expect(heroTonHinweise('light', undefined, 'https://b/h.jpg')).toEqual([])
    expect(heroTonHinweise('light', 'overlay', 'https://b/h.jpg')).toEqual([])
    expect(heroTonHinweise('dark', 'band', undefined)).toEqual([])
    expect(heroTonHinweise(undefined, 'band', undefined)).toEqual([])
  })

  it('light an anderem Layout oder ohne Bild bleibt ohne Wirkung und wird genannt', () => {
    expect(heroTonHinweise('light', 'band', 'https://b/h.jpg')[0]).toMatch(/wirkt nur bei hero_layout overlay/)
    expect(heroTonHinweise('light', 'overlay', undefined)[0]).toMatch(/ohne hero_image/)
  })

  it('ungueltiger Wert wirft auch hier', () => {
    expect(() => heroTonHinweise('hell', 'overlay', 'https://b/h.jpg')).toThrow(/hero_tone "hell"/)
  })
})

describe('heroHellBildPosition', () => {
  it('richtet waagrecht rechts aus und uebernimmt die Hoehe', () => {
    expect(heroHellBildPosition(undefined)).toBe('100% 50%')
    expect(heroHellBildPosition('50% 0%')).toBe('100% 0%')
    expect(() => heroHellBildPosition('oben')).toThrow(/Bildposition/)
  })
})
