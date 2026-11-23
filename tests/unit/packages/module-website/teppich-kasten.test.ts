// @vitest-environment node
/**
 * Kasten des Teppichs (Owner 23.11.2026): so breit wie die Antwort, so hoch wie der sichtbare
 * Bereich abzueglich Frage und Botschaft (der Versatz: `teppich-packen.test.ts`).
 */
import { describe, it, expect } from 'vitest'
import { TEPPICH_OBEN, TEPPICH_UNTEN, teppichKasten } from '@ks/module-website'

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
