// @vitest-environment node
/**
 * Animation `wolke` (Plan `teppich-der-dokumente` §3.6, T5d): eine Physik durch alle Stufen —
 * sammeln, explodieren, zurueck in die Form der Wolke, Kandidaten als Knaeuel, Belege als Kette
 * auf der Achse, dann heim. Dazu der Parameter `animation=` der Sektion.
 */
import { describe, it, expect, vi } from 'vitest'
import { parseAttrs, storylineLage } from '@ks/module-website'
import { TeppichWolkenPhysik, type WolkenSchrittEingabe } from '../../../../packages/module-website/src/react/teppich-wolken-physik'

const N = 120
const B = 800
const H = 500
// Eine Wolke: Punkte auf einer Spirale, Nachbarn = die naechsten in der Folge.
const px = Float32Array.from({ length: N }, (_, i) => B / 2 + Math.cos(i * 0.5) * (40 + i * 1.5))
const py = Float32Array.from({ length: N }, (_, i) => H / 2 + Math.sin(i * 0.5) * (40 + i * 1.2))
const radien = new Float32Array(N).fill(3)

function lauf(phys: TeppichWolkenPhysik, x: Float32Array, y: Float32Array, eingabe: Partial<WolkenSchrittEingabe>, von: number, bis: number): number {
  let zeit = von
  for (; zeit < bis; zeit += 16) {
    // Wie die Szene: alle daheim, die Physik ueberschreibt die bewegten.
    x.set(px); y.set(py)
    phys.schritt({
      phase: 'sucht', zeit, breite: B, hoehe: H, zelle: 12, radien, px, py,
      nachbarn: (i) => [i + 1, i + 2].filter((j) => j < N), kandidaten: [], belege: [], onGelandet: () => undefined,
      ...eingabe,
    }, x, y)
  }
  return zeit
}

describe('Parameter animation=', () => {
  it('liest wolke und schwarm, lehnt Unbekanntes laut ab', () => {
    expect(parseAttrs('layout=story animation=wolke').animation).toBe('wolke')
    expect(parseAttrs('layout=story').animation).toBeUndefined()
    expect(() => parseAttrs('layout=story animation=tanz')).toThrow(/animation/)
    expect(() => parseAttrs('layout=image-left animation=wolke')).toThrow(/layout=story/)
  })
})

describe('TeppichWolkenPhysik', () => {
  it('sammelt alle in der Mitte, sprengt sie und bringt die Wolke an ihre Plaetze zurueck', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    lauf(phys, x, y, {}, 0, 650)
    const zurMitte = Array.from(x, (v, i) => Math.hypot(v - B / 2, y[i] - H / 2))
    expect(Math.max(...zurMitte)).toBeLessThan(40)
    lauf(phys, x, y, {}, 650, 7000)
    const zumPlatz = Array.from(x, (v, i) => Math.hypot(v - px[i], y[i] - py[i]))
    expect(zumPlatz.reduce((s, d) => s + d, 0) / N).toBeLessThan(3)
  })

  it('zieht die Belege zur Kette auf der Achse, in ihrer Reihenfolge; dann Titel und gelandet', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    const kandidaten = [5, 30, 60, 90, 110, 15, 45]
    const belege = [90, 5, 60, 30]
    let zeit = lauf(phys, x, y, { kandidaten }, 0, 5000)
    const gelandet = vi.fn()
    zeit = lauf(phys, x, y, { phase: 'landet', kandidaten, belege, onGelandet: gelandet }, zeit, zeit + 9000)
    const { x: achse, ys } = storylineLage(belege.length, B, H)
    belege.forEach((i) => expect(Math.abs(x[i] - achse)).toBeLessThan(25))
    for (let k = 1; k < belege.length; k++) expect(y[belege[k]]).toBeGreaterThan(y[belege[k - 1]])
    expect(Math.abs(y[belege[0]] - ys[0])).toBeLessThan(40)
    expect(phys.titel).toBe(1)
    expect(gelandet).toHaveBeenCalledTimes(1)
  })

  it('bei der Antwort kehren alle heim, dann endet die Simulation', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    let zeit = lauf(phys, x, y, { kandidaten: [1, 2, 3] }, 0, 4500)
    zeit = lauf(phys, x, y, { phase: 'landet', kandidaten: [1, 2, 3], belege: [3, 1] }, zeit, zeit + 3000)
    expect(phys.aktiv).toBe(true)
    lauf(phys, x, y, { phase: 'antwort', belege: [3, 1] }, zeit, zeit + 12000)
    expect(phys.aktiv).toBe(false)
  })
})
