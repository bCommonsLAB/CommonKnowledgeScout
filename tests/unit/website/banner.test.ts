/**
 * Welle S1 — Banner-Regeln: Query-Bau, Limit-Pruefung, Cover-Titelgroesse.
 */
import { describe, it, expect } from 'vitest'
import {
  bannerGalerieParams, bannerLimitAus, bannerQuery, bannerSortAus, coverTitelGroesseVw, BANNER_LIMIT_DEFAULT,
} from '@/lib/website/banner'

describe('bannerQuery', () => {
  it('ohne Tag: Prioritaets-Reihung mit Ueberhang fuer entfernte Website-Docs', () => {
    expect(bannerQuery({ limit: 6 })).toBe('sort=rating&limit=11')
    expect(bannerQuery({ limit: 6, sort: 'rating' })).toBe('sort=rating&limit=11')
  })
  it('F3: sort stars = Rangliste, nur Eintraege mit Stern (Server filtert)', () => {
    expect(bannerQuery({ limit: 6, sort: 'stars' })).toBe('sort=stars&starred=1&limit=11')
    expect(bannerQuery({ limit: 3, sort: 'stars', tag: 'fokus' })).toBe('sort=stars&starred=1&limit=8&tags=fokus')
  })
  it('mit Tag: Facetten-Filter tags= (URL-kodiert)', () => {
    expect(bannerQuery({ tag: 'fokus', limit: 6 })).toBe('sort=rating&limit=11&tags=fokus')
    expect(bannerQuery({ tag: ' Öko Tag ', limit: 3 })).toBe('sort=rating&limit=8&tags=%C3%96ko%20Tag')
  })
  it('leerer Tag zaehlt nicht als Filter', () => {
    expect(bannerQuery({ tag: '   ', limit: 6 })).toBe('sort=rating&limit=11')
  })
})

describe('bannerLimitAus', () => {
  it('fehlend = Vorgabe', () => {
    expect(bannerLimitAus(undefined)).toBe(BANNER_LIMIT_DEFAULT)
    expect(bannerLimitAus('')).toBe(BANNER_LIMIT_DEFAULT)
  })
  it('nimmt Zahl oder Zahltext im Bereich 3..12', () => {
    expect(bannerLimitAus(9)).toBe(9)
    expect(bannerLimitAus('12')).toBe(12)
  })
  it('weist Bereichsverletzung und Unsinn laut ab', () => {
    expect(() => bannerLimitAus(2)).toThrow(/banner_limit "2"/)
    expect(() => bannerLimitAus(13)).toThrow(/banner_limit/)
    expect(() => bannerLimitAus('viele')).toThrow(/banner_limit "viele"/)
    expect(() => bannerLimitAus(4.5)).toThrow(/banner_limit/)
  })
})

describe('bannerSortAus (F3, ADR 0012)', () => {
  it('fehlend = rating', () => {
    expect(bannerSortAus(undefined)).toBe('rating')
    expect(bannerSortAus(null)).toBe('rating')
    expect(bannerSortAus('')).toBe('rating')
  })
  it('nimmt rating und stars, auch mit Leerraum', () => {
    expect(bannerSortAus('rating')).toBe('rating')
    expect(bannerSortAus(' stars ')).toBe('stars')
  })
  it('weist Unbekanntes laut ab, kein stiller Fallback', () => {
    expect(() => bannerSortAus('sterne')).toThrow(/banner_sort "sterne"/)
    expect(() => bannerSortAus(1)).toThrow(/erlaubt rating, stars/)
  })
})

describe('bannerGalerieParams', () => {
  it('stars nimmt die Rangliste in die Galerie mit, rating nichts', () => {
    expect(bannerGalerieParams('stars')).toBe('starred=1&sort=stars')
    expect(bannerGalerieParams('rating')).toBe('')
    expect(bannerGalerieParams(undefined)).toBe('')
  })
})

describe('coverTitelGroesseVw', () => {
  it('kurze Woerter behalten die Vorlage-Groesse', () => {
    expect(coverTitelGroesseVw('Oldies for Future')).toBe(19)
  })
  it('ein langes Wort wird so klein, dass es in 88 vw passt', () => {
    const vw = coverTitelGroesseVw('Klimakaffee')
    expect(vw).toBeLessThan(19)
    expect(vw * 11 * 0.7).toBeLessThanOrEqual(88)
  })
  it('leerer Titel = Vorlage-Groesse', () => {
    expect(coverTitelGroesseVw('   ')).toBe(19)
  })
})
