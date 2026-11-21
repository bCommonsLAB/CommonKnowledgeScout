// @vitest-environment node
/**
 * Zustand der Buehne aus der Adresse (`?buehne=`, Plan `commonux-buehne-fragen-sektion`, K4).
 */
import { describe, it, expect } from 'vitest'
import { buehnenModus } from '@/components/library/website/buehne/use-website-buehne'

describe('buehnenModus', () => {
  it('ohne Parameter ist die Buehne aus', () => {
    expect(buehnenModus(null)).toBe('aus')
  })

  it('`an` legt sie hinter den Text, `vorn` stellt sie davor', () => {
    expect(buehnenModus('an')).toBe('hinten')
    expect(buehnenModus('vorn')).toBe('vorn')
  })

  it('ein unbekannter Wert ist ein Fehler, kein stilles „aus"', () => {
    expect(() => buehnenModus('hinten')).toThrow(/Unbekannter Wert/)
  })
})
