// @vitest-environment node
/**
 * Animation `wolke` (Plan `teppich-der-dokumente` §3.6, T5d): eine Physik durch alle Stufen —
 * sammeln, explodieren, zurueck in die Form der Wolke, Kandidaten als Knaeuel, Belege als Kette
 * auf der Achse, dann heim. Dazu der Parameter `animation=` der Sektion.
 */
import { describe, it, expect, vi } from 'vitest'
import { parseAttrs } from '@ks/module-website'
import { wolkenStoryline } from '../../../../packages/module-website/src/react/teppich-wolken-kraefte'
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

describe('TeppichWolkenPhysik (elastisches Netz)', () => {
  const mittlererAbstand = (x: Float32Array, y: Float32Array) =>
    Array.from(x, (v, i) => Math.hypot(v - px[i], y[i] - py[i])).reduce((s, d) => s + d, 0) / N

  it('sammelt alle in der Mitte, sprengt sie, und das Netz formt die Wolke neu', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    lauf(phys, x, y, {}, 0, 1350)
    const zurMitte = Array.from(x, (v, i) => Math.hypot(v - B / 2, y[i] - H / 2))
    expect(Math.max(...zurMitte)).toBeLessThan(40)
    lauf(phys, x, y, {}, 1350, 12000)
    // Mehr oder weniger genau (Owner 23.11.2026): die Form, nicht jeder Punkt exakt.
    expect(mittlererAbstand(x, y)).toBeLessThan(15)
  })

  it('das Netz zieht die Nachbarn der Kandidaten mit — staerker als ferne Punkte', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    let zeit = lauf(phys, x, y, {}, 0, 6000)
    const vorherX = Float32Array.from(x), vorherY = Float32Array.from(y)
    const kandidaten = [110, 112]
    zeit = lauf(phys, x, y, { kandidaten }, zeit, zeit + 3000)
    const weg = (i: number) => Math.hypot(x[i] - vorherX[i], y[i] - vorherY[i])
    // 108, 109 haengen am Netz direkt an 110; 20 liegt weit weg.
    expect(weg(108) + weg(109)).toBeGreaterThan(4 * weg(20))
  })

  it('ordnet die Belege als Kette auf einer Achse in der Mitte, in ihrer Reihenfolge; dann Titel', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    const kandidaten = [5, 30, 60, 90, 110, 15, 45]
    const belege = [90, 5, 60, 30]
    let zeit = lauf(phys, x, y, { kandidaten }, 0, 5000)
    const gelandet = vi.fn()
    zeit = lauf(phys, x, y, { phase: 'landet', kandidaten, belege, onGelandet: gelandet }, zeit, zeit + 9000)
    const { ys } = wolkenStoryline(belege.length, B, H)
    belege.forEach((i) => expect(Math.abs(x[i] - B / 2)).toBeLessThan(30))
    for (let k = 1; k < belege.length; k++) expect(y[belege[k]]).toBeGreaterThan(y[belege[k - 1]])
    expect(Math.abs(y[belege[0]] - ys[0])).toBeLessThan(40)
    expect(phys.titel).toBe(1)
    expect(gelandet).toHaveBeenCalledTimes(1)
  })

  it('nach der Antwort ist alles losgelassen: das Netz findet in die Wolke zurueck', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    let zeit = lauf(phys, x, y, { kandidaten: [1, 2, 3] }, 0, 4500)
    zeit = lauf(phys, x, y, { phase: 'landet', kandidaten: [1, 2, 3], belege: [3, 1] }, zeit, zeit + 6000)
    const imZug = mittlererAbstand(x, y)
    lauf(phys, x, y, { phase: 'antwort', belege: [3, 1] }, zeit, zeit + 15000)
    expect(mittlererAbstand(x, y)).toBeLessThan(imZug)
    expect(mittlererAbstand(x, y)).toBeLessThan(15)
  })
  it('bewegt weich: kleine Spruenge je Bild, die Storyline formt sich ueber Sekunden', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    let ax = Float32Array.from(px), ay = Float32Array.from(py)
    let sprung = 0
    let spaeteBewegung = 0
    for (let zeit = 0; zeit < 16000; zeit += 16) {
      const landet = zeit >= 9000
      lauf(phys, x, y, { phase: landet ? 'landet' : 'sucht', kandidaten: zeit > 3000 ? [5, 30, 60, 90] : [], belege: landet ? [90, 5, 60] : [] }, zeit, zeit + 1)
      let m = 0
      for (let i = 0; i < N; i++) m = Math.max(m, Math.hypot(x[i] - ax[i], y[i] - ay[i]))
      // Nach dem Explosionsstoss (erste Sekunden) springt kein Punkt mehr weit.
      if (zeit > 2500) sprung = Math.max(sprung, m)
      // Noch eine Sekunde nach dem Wechsel zur Storyline bewegt sich etwas (kein Schnappen).
      if (zeit > 10000 && zeit < 10500) spaeteBewegung += m
      ax = Float32Array.from(x); ay = Float32Array.from(y)
    }
    expect(sprung).toBeLessThan(8)
    expect(spaeteBewegung).toBeGreaterThan(1)
  })
  it('eine Groessenaenderung der Flaeche startet nichts neu: kein Sprung, keine zweite Explosion', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    let zeit = lauf(phys, x, y, {}, 0, 2000)
    // Wie auf der Seite gemessen: die Flaeche wird mehrmals hoeher, die Plaetze neu gepackt.
    let sprung = 0
    for (const h of [520, 560, 600]) {
      const qy = Float32Array.from(py, (v) => v + (h - H) / 2)
      for (const ende = zeit + 300; zeit < ende; zeit += 16) {
        const ax = Float32Array.from(x), ay = Float32Array.from(y)
        lauf(phys, x, y, { hoehe: h, py: qy }, zeit, zeit + 1)
        for (let i = 0; i < N; i++) sprung = Math.max(sprung, Math.hypot(x[i] - ax[i], y[i] - ay[i]))
      }
    }
    expect(sprung).toBeLessThan(8)
  })

  it('eine lange Kette (19 Belege) steht gerade und gleichmaessig, bevor die Titel kommen — ohne Sprung', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    const belege = [100, 3, 57, 22, 81, 40, 9, 66, 115, 31, 74, 50, 12, 93, 28, 61, 107, 45, 18]
    let zeit = lauf(phys, x, y, { kandidaten: belege }, 0, 8000)
    const { ys, zeile } = wolkenStoryline(belege.length, B, H)
    let sprung = 0
    let beiTitel: number | null = null
    let titelNach: number | null = null
    const start = zeit
    for (const ende = zeit + 12000; zeit < ende; zeit += 16) {
      const ax = Float32Array.from(x), ay = Float32Array.from(y)
      lauf(phys, x, y, { phase: 'landet', kandidaten: belege, belege }, zeit, zeit + 1)
      for (let i = 0; i < N; i++) sprung = Math.max(sprung, Math.hypot(x[i] - ax[i], y[i] - ay[i]))
      // Im Moment, in dem die Titel beginnen: wie weit ist der fernste Beleg von seinem Platz?
      if (titelNach === null && phys.titel > 0) titelNach = zeit - start
      if (beiTitel === null && phys.titel > 0) beiTitel = Math.max(...belege.map((i, k) => Math.hypot(x[i] - B / 2, y[i] - ys[k])))
    }
    expect(beiTitel).not.toBeNull()
    // Bestimmt: Die Kette kommt an, lange bevor die Hoechstzeit (10 s) greift.
    expect(titelNach as number).toBeLessThan(8000)
    expect(beiTitel as number).toBeLessThan(3)
    belege.forEach((i) => expect(Math.abs(x[i] - B / 2)).toBeLessThan(3))
    for (let k = 1; k < belege.length; k++) expect(Math.abs(y[belege[k]] - y[belege[k - 1]] - zeile)).toBeLessThan(3)
    // Gemaechlich: kein Punkt springt auf dem Weg zur Achse.
    expect(sprung).toBeLessThan(6)
  })

  it('vom Knaeuel zur Kette ohne Sprung; nachkommende Kandidaten loesen keinen neuen Stoss aus', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    const alle = [5, 30, 60, 90, 110, 15, 45, 75]
    const belege = [90, 5, 60, 30]
    let ax = Float32Array.from(px), ay = Float32Array.from(py)
    let sprung = 0
    for (let zeit = 0; zeit < 16000; zeit += 16) {
      // Die Kandidaten treffen nach und nach ein (wie auf der Seite).
      const kandidaten = zeit < 7000 ? alle.slice(0, Math.max(0, Math.floor((zeit - 6000) / 150))) : alle
      const landet = zeit >= 10000
      lauf(phys, x, y, { phase: landet ? 'landet' : 'sucht', kandidaten, belege: landet ? belege : [] }, zeit, zeit + 1)
      let m = 0
      for (let i = 0; i < N; i++) m = Math.max(m, Math.hypot(x[i] - ax[i], y[i] - ay[i]))
      if (zeit > 5800) sprung = Math.max(sprung, m)
      ax = Float32Array.from(x); ay = Float32Array.from(y)
    }
    expect(sprung).toBeLessThan(4)
    expect(phys.uebergang).toBe(1)
  })
  it('die Belege setzen in der Reihenfolge ihrer Nummern ein, nicht gleichzeitig', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    const belege = [100, 3, 57, 22, 81, 40, 9, 66, 115, 31]
    let zeit = lauf(phys, x, y, { kandidaten: belege }, 0, 8000)
    // Eine halbe Sekunde nach Beginn der Storyline: die ersten sind markiert, die letzten noch nicht.
    zeit = lauf(phys, x, y, { phase: 'landet', kandidaten: belege, belege }, zeit, zeit + 500)
    expect(phys.belegMarke(0)).toBe(1)
    expect(phys.belegMarke(9)).toBe(0)
    expect(phys.belegEin(0)).toBeGreaterThan(phys.belegEin(3))
    expect(phys.belegEin(9)).toBe(0)
    // Am Ende sind alle markiert und unterwegs gewesen.
    lauf(phys, x, y, { phase: 'landet', kandidaten: belege, belege }, zeit, zeit + 6000)
    expect(phys.belegMarke(9)).toBe(1)
    expect(phys.belegEin(9)).toBe(1)
  })
  it('ziehen: der Punkt folgt dem Zeiger, die Nachbarn im Netz ziehen mit, nach dem Loslassen kehrt alles heim', () => {
    const phys = new TeppichWolkenPhysik()
    const x = new Float32Array(N), y = new Float32Array(N)
    // Auch ohne vorherige Frage: Das Ziehen weckt die Rechnung.
    phys.zieh(60, px[60] + 120, py[60] - 80)
    let zeit = lauf(phys, x, y, { phase: 'ruhe' }, 0, 3000)
    expect(Math.hypot(x[60] - (px[60] + 120), y[60] - (py[60] - 80))).toBeLessThan(2)
    const weg = (i: number) => Math.hypot(x[i] - px[i], y[i] - py[i])
    // 61 und 62 haengen am Netz direkt an 60; 5 liegt weit weg.
    expect(weg(61)).toBeGreaterThan(5)
    expect(weg(61) + weg(62)).toBeGreaterThan(4 * weg(5))
    phys.lasse()
    lauf(phys, x, y, { phase: 'ruhe' }, zeit, zeit + 15000)
    expect(weg(60)).toBeLessThan(15)
  })
})
