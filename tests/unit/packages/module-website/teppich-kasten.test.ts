// @vitest-environment node
/**
 * Kasten des Teppichs (Owner 23.11.2026): so breit wie die Antwort, so hoch wie der sichtbare
 * Bereich abzueglich Frage und Botschaft; das Raster liegt mittig in der breiteren Leinwand.
 */
import { describe, it, expect } from 'vitest'
import { TEPPICH_OBEN, TEPPICH_UNTEN, packeTeppich, teppichKasten, type TeppichPunkt } from '@ks/module-website'

const RESERVE = TEPPICH_OBEN + TEPPICH_UNTEN

describe('teppichKasten', () => {
  it('breite Sektion: so breit wie die Antwort (1024), mittig, sichtbare Hoehe', () => {
    expect(teppichKasten(1600, 900, 2000)).toEqual({ breite: 1024, hoehe: 900 - RESERVE, links: 288 })
  })

  it('schmal (Telefon): Breite minus Rand der Sektion', () => {
    expect(teppichKasten(375, 800, 2000)).toEqual({ breite: 327, hoehe: 800 - RESERVE, links: 24 })
  })

  it('niedrige Sektion begrenzt die Hoehe', () => {
    expect(teppichKasten(1600, 1200, 400).hoehe).toBe(400 - RESERVE)
  })
})

describe('packeTeppich mit versatz', () => {
  it('verschiebt Punkte und Jahreszahlen um den versatz nach rechts', () => {
    const punkte: TeppichPunkt[] = Array.from({ length: 20 }, (_, i) =>
      ({ fileId: `f${i}`, x: i / 20, y: 0.5, gewicht: null, jahr: 2000 + i, titel: `T${i}` }))
    const ohne = packeTeppich(punkte, { breite: 400, hoehe: 200, rand: 10 })
    const mit = packeTeppich(punkte, { breite: 400, hoehe: 200, rand: 10, versatz: 100 })
    expect(mit.px[3]).toBeCloseTo(ohne.px[3] + 100)
    expect(mit.py[3]).toBeCloseTo(ohne.py[3])
    expect(mit.jahrMarken[0].x).toBeCloseTo(ohne.jahrMarken[0].x + 100)
  })
})
