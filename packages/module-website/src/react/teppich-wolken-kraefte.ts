/**
 * Kraefte der Animation `wolke` je Stufe (Plan `teppich-der-dokumente` §3.6, Owner 23.11.2026).
 *
 * Eine Simulation, ein Bewegungsmuster: Jede Stufe setzt nur Kanten, Ziele und Staerken neu.
 * Ziele: `heim` (der Platz in der Wolke), `mitte` (Mitte des Kastens), `achse` (Platz in der
 * Storyline). Reine Funktion ohne DOM; die Simulation baut `teppich-wolken-physik.ts`.
 */

import { storylineLage } from '..'

/** Stufen der Animation; `sammeln` und `explosion` gibt es nur in ihr, nicht als Phase der Frage. */
export type WolkenStufe = 'sammeln' | 'explosion' | 'auswahl' | 'storyline' | 'heim'

export interface WolkenKante { a: number; b: number; abstand: number; staerke: number }
export interface WolkenZiel { x: number; y: number; zugX: number; zugY: number }

export interface WolkenKraefteEingabe {
  stufe: WolkenStufe
  breite: number
  hoehe: number
  zelle: number
  px: Float32Array
  py: Float32Array
  /** Staerkste Nachbarn je Punkt (Indizes, aus der Route). */
  nachbarn: (i: number) => readonly number[]
  kandidaten: readonly number[]
  belege: readonly number[]
  /** Anteil 0..1 der Explosion, die schon verstrichen ist — der Zug heim waechst mit ihr. */
  explosionsAnteil: number
}

export interface WolkenKraefte {
  kanten: WolkenKante[]
  ziel: (i: number) => WolkenZiel
  /** Abstossung zwischen den Punkten (negativ). */
  abstossung: number
  kollision: boolean
}

/** Kette ueber eine Folge: jeder mit dem `weite`-naechsten. */
function kette(folge: readonly number[], abstand: number, staerke: number, weite: number): WolkenKante[] {
  const out: WolkenKante[] = []
  for (let k = 0; k + weite < folge.length; k++) out.push({ a: folge[k], b: folge[k + weite], abstand: abstand * weite, staerke })
  return out
}

export function wolkenKraefte(e: WolkenKraefteEingabe, beteiligt: readonly number[]): WolkenKraefte {
  const mx = e.breite / 2
  const my = e.hoehe / 2
  const heim = (i: number, zug: number): WolkenZiel => ({ x: e.px[i], y: e.py[i], zugX: zug, zugY: zug })
  switch (e.stufe) {
    case 'sammeln':
      // Alle zieht es in einen Punkt in der Mitte.
      return { kanten: [], ziel: () => ({ x: mx, y: my, zugX: 0.22, zugY: 0.22 }), abstossung: 0, kollision: false }
    case 'explosion': {
      // Die Abstossung sprengt den Punkt; die Nachbarn halten zusammen; der Zug heim waechst,
      // Abstossung und Kanten klingen ab — am Ende steht die Wolke wieder genau in ihrer Form.
      const rest = 1 - e.explosionsAnteil
      const im = new Set(beteiligt)
      const kanten: WolkenKante[] = []
      for (const i of beteiligt) {
        for (const j of e.nachbarn(i)) if (i < j && im.has(j)) kanten.push({ a: i, b: j, abstand: e.zelle * 1.6, staerke: 0.3 * rest })
      }
      const zug = 0.003 + 0.12 * e.explosionsAnteil * e.explosionsAnteil
      return { kanten, ziel: (i) => heim(i, zug), abstossung: -Math.max(6, e.zelle * 1.2) * rest, kollision: false }
    }
    case 'auswahl': {
      // Neue Beziehungen: jeder Kandidat mit dem naechsten und uebernaechsten — sie wandern zusammen.
      const kand = new Set(e.kandidaten)
      return {
        kanten: [...kette(e.kandidaten, e.zelle * 2.2, 0.35, 1), ...kette(e.kandidaten, e.zelle * 2.2, 0.2, 2)],
        ziel: (i) => (kand.has(i) ? { x: mx, y: my, zugX: 0.012, zugY: 0.012 } : heim(i, 0.1)),
        abstossung: -Math.max(8, e.zelle * 1.5),
        kollision: true,
      }
    }
    case 'storyline': {
      // Die Kette der Belege: jeder haengt stark am vorhergehenden, alle zieht es auf die Achse.
      const { x: achse, ys, zeile } = storylineLage(e.belege.length, e.breite, e.hoehe)
      const platz = new Map(e.belege.map((i, k) => [i, ys[k]]))
      return {
        kanten: [...kette(e.belege, zeile, 0.9, 1), ...kette(e.belege, zeile, 0.25, 2)],
        ziel: (i) => {
          const y = platz.get(i)
          return y === undefined ? heim(i, 0.09) : { x: achse, y, zugX: 0.12, zugY: 0.04 }
        },
        abstossung: -Math.max(8, e.zelle * 1.5),
        kollision: true,
      }
    }
    case 'heim':
      // Nur der Zug heim: so kommt jeder Punkt genau an seinem Platz an.
      return { kanten: [], ziel: (i) => heim(i, 0.09), abstossung: 0, kollision: false }
    default: {
      const unbekannt: never = e.stufe
      throw new Error(`Unbekannte Stufe der Wolke: ${String(unbekannt)}`)
    }
  }
}
