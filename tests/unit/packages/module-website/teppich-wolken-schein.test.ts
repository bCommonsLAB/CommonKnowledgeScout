// @vitest-environment node
/**
 * Animation `wolke` (Owner 23.11.2026): Kandidaten setzen nacheinander ein, nicht im selben Bild;
 * die Wolke dreht sich ganz langsam, die Belege der Storyline bleiben stehen.
 */
import { describe, it, expect } from 'vitest'
import { STAFFEL_MS, TeppichStaffel, UMDREHUNG_MS, dreheWolke } from '../../../../packages/module-website/src/react/teppich-wolken-schein'

describe('TeppichStaffel', () => {
  it('setzt die Kandidaten innerhalb der Staffel-Zeit nacheinander ein', () => {
    const staffel = new TeppichStaffel()
    const kandidaten = new Set([3, 7, 11, 15, 19, 23, 27, 31, 35, 39])
    expect(staffel.schritt(kandidaten, 1000)).toEqual([3])
    expect(staffel.schritt(kandidaten, 1000 + STAFFEL_MS / 2).length).toBe(6)
    expect(staffel.schritt(kandidaten, 1000 + STAFFEL_MS).length).toBe(10)
    // Jeder wird fuer sich dunkel: der erste ist schon voll, der letzte hat gerade erst begonnen.
    expect(staffel.staerke(3, 1000 + STAFFEL_MS)).toBe(1)
    expect(staffel.staerke(39, 1000 + STAFFEL_MS)).toBeLessThan(0.5)
    expect(staffel.staerke(99, 2000)).toBe(0)
  })

  it('spaeter gemeldete Kandidaten bekommen ihren eigenen Einsatz; entfallene sind vergessen', () => {
    const staffel = new TeppichStaffel()
    staffel.schritt(new Set([1, 2]), 0)
    expect(staffel.schritt(new Set([1, 2, 5, 6]), 2000)).toEqual([1, 2, 5])
    expect(staffel.schritt(new Set([5]), 4000)).toEqual([5])
    expect(staffel.staerke(1, 4000)).toBe(0)
  })
})

describe('dreheWolke', () => {
  it('dreht langsam um die Mitte: kaum merklich je Bild, eine Vierteldrehung in einem Viertel der Zeit', () => {
    const x = Float32Array.from([200, 100]), y = Float32Array.from([100, 100])
    dreheWolke(x, y, 100, 100, 16, () => 1)
    expect(Math.hypot(x[0] - 200, y[0] - 100)).toBeLessThan(0.05)
    expect(x[1]).toBe(100)
    const qx = Float32Array.from([200]), qy = Float32Array.from([100])
    dreheWolke(qx, qy, 100, 100, UMDREHUNG_MS / 4, () => 1)
    expect(qx[0]).toBeCloseTo(100, 3)
    expect(qy[0]).toBeCloseTo(200, 3)
  })

  it('Punkte mit Gewicht 0 bleiben stehen (die Achse der Storyline)', () => {
    const x = Float32Array.from([200, 200]), y = Float32Array.from([100, 100])
    dreheWolke(x, y, 100, 100, UMDREHUNG_MS / 4, (i) => (i === 0 ? 0 : 1))
    expect([x[0], y[0]]).toEqual([200, 100])
    expect(y[1]).toBeCloseTo(200, 3)
  })
})
