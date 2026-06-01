import { describe, it, expect } from 'vitest'
import {
  SDG_LIST,
  SDG_COUNT,
  coerceSdgValue,
  extractSdgValues,
  extractSdgBegruendung,
  hasSdgData,
  sdgIconPath,
} from '@/lib/gallery/sdg-meta'
import {
  spokeAngleDeg,
  fillRadius,
  polarToCartesian,
} from '@/components/library/gallery/sdg-wheel'

describe('sdg-meta Stammdaten', () => {
  it('enthält genau 17 SDGs mit fortlaufenden Ids 1..17', () => {
    expect(SDG_LIST).toHaveLength(SDG_COUNT)
    expect(SDG_LIST.map((s) => s.id)).toEqual(
      Array.from({ length: 17 }, (_, i) => i + 1),
    )
  })

  it('hat eindeutige Farben und metaKeys', () => {
    const colors = new Set(SDG_LIST.map((s) => s.color.toUpperCase()))
    const keys = new Set(SDG_LIST.map((s) => s.metaKey))
    expect(colors.size).toBe(17)
    expect(keys.size).toBe(17)
  })
})

describe('coerceSdgValue', () => {
  it('akzeptiert Zahlen im Bereich und clamped außerhalb', () => {
    expect(coerceSdgValue(0)).toBe(0)
    expect(coerceSdgValue(0.42)).toBe(0.42)
    expect(coerceSdgValue(1)).toBe(1)
    expect(coerceSdgValue(1.5)).toBe(1)
    expect(coerceSdgValue(-0.2)).toBe(0)
  })

  it('parst numerische Strings, sonst null', () => {
    expect(coerceSdgValue('0.5')).toBe(0.5)
    expect(coerceSdgValue('')).toBeNull()
    expect(coerceSdgValue('abc')).toBeNull()
    expect(coerceSdgValue(undefined)).toBeNull()
    expect(coerceSdgValue(null)).toBeNull()
    expect(coerceSdgValue(NaN)).toBeNull()
  })
})

describe('extractSdgValues / hasSdgData', () => {
  it('liefert 17 Werte in fester Reihenfolge, fehlende als null', () => {
    const values = extractSdgValues({ sdg_1: 0.8, sdg_13: 1, sdg_7: '0.3' })
    expect(values).toHaveLength(17)
    expect(values[0]).toEqual({ id: 1, value: 0.8 })
    expect(values[6]).toEqual({ id: 7, value: 0.3 })
    expect(values[12]).toEqual({ id: 13, value: 1 })
    expect(values[1]).toEqual({ id: 2, value: null })
  })

  it('hasSdgData ist false ohne gültige Werte', () => {
    expect(hasSdgData(undefined)).toBe(false)
    expect(hasSdgData({})).toBe(false)
    expect(hasSdgData({ sdg_1: 'abc' })).toBe(false)
    expect(hasSdgData({ sdg_5: 0 })).toBe(true)
  })
})

describe('extractSdgBegruendung', () => {
  it('liefert getrimmten String oder null', () => {
    expect(extractSdgBegruendung({ sdg_begruendung: 'Text' })).toBe('Text')
    expect(extractSdgBegruendung({ sdg_begruendung: '   ' })).toBeNull()
    expect(extractSdgBegruendung({})).toBeNull()
    expect(extractSdgBegruendung({ sdg_begruendung: 42 })).toBeNull()
  })
})

describe('sdg-wheel Geometrie', () => {
  it('spokeAngleDeg startet oben und verteilt gleichmäßig', () => {
    expect(spokeAngleDeg(0, 17)).toBe(-90)
    expect(spokeAngleDeg(17, 17)).toBe(-90 + 360)
    expect(spokeAngleDeg(1, 4)).toBe(0)
  })

  it('fillRadius gibt innerRadius bei null und clamped Werte', () => {
    expect(fillRadius(null, 10, 100)).toBe(10)
    expect(fillRadius(0, 10, 100)).toBe(10)
    expect(fillRadius(1, 10, 100)).toBe(100)
    expect(fillRadius(0.5, 10, 100)).toBe(55)
    expect(fillRadius(2, 10, 100)).toBe(100)
    expect(fillRadius(-1, 10, 100)).toBe(10)
  })

  it('polarToCartesian projiziert korrekt (oben = -90°)', () => {
    const p = polarToCartesian(50, 50, 40, -90)
    expect(p.x).toBeCloseTo(50, 5)
    expect(p.y).toBeCloseTo(10, 5)
  })

  it('sdgIconPath erzeugt den Asset-Pfad je Ziel-Nummer', () => {
    expect(sdgIconPath(1)).toBe('/sdg-icons/sdg-1.svg')
    expect(sdgIconPath(17)).toBe('/sdg-icons/sdg-17.svg')
  })
})
