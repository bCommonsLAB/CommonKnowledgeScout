// @vitest-environment node
/**
 * Kasten des Teppichs (Owner 23.11.2026): so breit wie die Antwort, zwei Drittel des sichtbaren
 * Bereichs abzueglich Frage und Botschaft hoch — und nur davon abhaengig, damit die Wolke beim
 * Fragen nicht springt (der Versatz: `teppich-packen.test.ts`).
 */
import { describe, it, expect } from 'vitest'
import { TEPPICH_OBEN, TEPPICH_UNTEN, teppichKasten } from '@ks/module-website'

const RESERVE = TEPPICH_OBEN + TEPPICH_UNTEN
const zweiDrittel = (sicht: number) => Math.floor(((sicht - RESERVE) * 2) / 3)

describe('teppichKasten', () => {
  it('breite Sektion: so breit wie die Antwort (1024), mittig, zwei Drittel der sichtbaren Hoehe', () => {
    expect(teppichKasten(1600, 900)).toEqual({ breite: 1024, hoehe: zweiDrittel(900), links: 288 })
  })

  it('schmal (Telefon): Breite minus Rand der Sektion', () => {
    expect(teppichKasten(375, 800)).toEqual({ breite: 327, hoehe: zweiDrittel(800), links: 24 })
  })

  it('sehr niedriges Fenster: nie negativ', () => {
    expect(teppichKasten(1600, 100).hoehe).toBe(0)
  })
})
