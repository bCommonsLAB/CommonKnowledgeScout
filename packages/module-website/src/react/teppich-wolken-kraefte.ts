/**
 * Kraefte der Animation `wolke` je Stufe (Plan `teppich-der-dokumente` §3.6, Owner 23.11.2026).
 *
 * Die Wolke ist ein elastisches Netz wie in der Graph-Ansicht: Jede Verbindung zwischen aehnlichen
 * Dokumenten ist eine Feder, deren Ruhelaenge genau der Abstand der beiden Punkte in der
 * gespeicherten Wolke ist. In Ruhe zieht keine Feder; wird ein Punkt gezogen, zieht er seine
 * Nachbarn mit, diese ihre, und die ganze Wolke verformt sich. Die Feder zum eigenen Platz ist nur
 * schwach — sie haelt die Wolke an ihrem Ort, nicht jeden Punkt an seinem.
 *
 * Stufen: `sammeln`, `explosion`, `auswahl`, `storyline`, `frei`. Jede Stufe blendet ihre Kraefte
 * mit `ein` (0..1) ein; die Storyline blendet zugleich die Kraefte der Auswahl aus — kein Umschalten,
 * ein Ueberblenden (Owner 23.11.2026: „der Uebergang ist zu abrupt"). Reine Funktion ohne DOM.
 */

import { storylineLage } from '..'

export type WolkenStufe = 'sammeln' | 'explosion' | 'auswahl' | 'storyline' | 'frei'

export interface WolkenKante { a: number; b: number; abstand: number; staerke: number }
export interface WolkenZiel { x: number; y: number; zugX: number; zugY: number }

export interface WolkenKraefteEingabe {
  stufe: WolkenStufe
  breite: number
  hoehe: number
  zelle: number
  px: Float32Array
  py: Float32Array
  radien: Float32Array
  /** Staerkste Nachbarn je Punkt (Indizes, aus der Route). */
  nachbarn: (i: number) => readonly number[]
  kandidaten: readonly number[]
  belege: readonly number[]
  /** Anteil 0..1 der Stufe, der schon verstrichen ist (Explosion, Loslassen). */
  anteil: number
  /** Wie weit die Kraefte der Stufe eingeblendet sind (0..1). */
  ein: number
  /** Storyline: wie weit der `k`-te Beleg (Reihenfolge der Nummern) schon an seinen Platz zieht (0..1). */
  belegEin: (k: number) => number
}

export interface WolkenKraefte {
  kanten: WolkenKante[]
  ziel: (i: number) => WolkenZiel
  /** Abstand halten (kein Ueberlappen); die `aktiv`en schieben weiter. `null` = aus. */
  abstand: { aktiv: ReadonlySet<number>; reichweite: (i: number) => number } | null
}

/** Federstaerke des Netzes und Zug zum eigenen Platz in Ruhe. */
const NETZ = 0.3
const HEIM = 0.004
/** Zug der Kandidaten zur Mitte und Kette der Kandidaten. */
const ZUR_MITTE = 0.05
const KNAEUEL = 0.4
/** Zug der Belege an ihren Platz auf der Achse, voll eingeblendet. */
const ACHSE = 0.85

/** Platz oben in der Leinwand, den der Frage-Block der Konversation ueberdeckt (Pixel). */
const FRAGE_BLOCK = 92

/**
 * Lage der Storyline in der Wolke: wie `storylineLage`, aber unter dem Frage-Block, der oben ueber
 * der Leinwand liegt — sonst stuenden die ersten Belege und ihre Titel unter der Frage.
 */
export function wolkenStoryline(anzahl: number, breite: number, hoehe: number): { ys: number[]; zeile: number } {
  const kopf = Math.min(FRAGE_BLOCK, hoehe * 0.25)
  const { ys, zeile } = storylineLage(anzahl, breite, hoehe - kopf)
  return { ys: ys.map((y) => y + kopf), zeile }
}

/** Das Netz: jede Verbindung einmal, Ruhelaenge = Abstand in der gespeicherten Wolke. */
export function wolkenNetz(e: Pick<WolkenKraefteEingabe, 'px' | 'py' | 'nachbarn'>, staerke = NETZ): WolkenKante[] {
  const kanten: WolkenKante[] = []
  const gesehen = new Set<number>()
  const n = e.px.length
  for (let i = 0; i < n; i++) {
    for (const j of e.nachbarn(i)) {
      if (j === i || j < 0 || j >= n) continue
      const schluessel = i < j ? i * n + j : j * n + i
      if (gesehen.has(schluessel)) continue
      gesehen.add(schluessel)
      kanten.push({ a: i, b: j, abstand: Math.hypot(e.px[i] - e.px[j], e.py[i] - e.py[j]), staerke })
    }
  }
  return kanten
}

/** Kette ueber eine Folge: jeder mit dem `weite`-naechsten. */
function kette(folge: readonly number[], abstand: number, staerke: number, weite: number): WolkenKante[] {
  const out: WolkenKante[] = []
  if (staerke <= 0) return out
  for (let k = 0; k + weite < folge.length; k++) out.push({ a: folge[k], b: folge[k + weite], abstand: abstand * weite, staerke })
  return out
}

/** Mehrere lineare Federn auf einen Punkt zu einer zusammengefasst (gewichtete Mitte). */
function zusammen(...federn: Array<[number, number, number, number]>): WolkenZiel {
  let zx = 0, zy = 0, sx = 0, sy = 0
  for (const [x, y, kx, ky] of federn) { sx += kx * x; sy += ky * y; zx += kx; zy += ky }
  return { x: zx > 0 ? sx / zx : federn[0][0], y: zy > 0 ? sy / zy : federn[0][1], zugX: zx, zugY: zy }
}

export function wolkenKraefte(e: WolkenKraefteEingabe, netz: readonly WolkenKante[]): WolkenKraefte {
  const mx = e.breite / 2
  const my = e.hoehe / 2
  const ein = e.ein
  const heim = (i: number, zug: number): WolkenZiel => ({ x: e.px[i], y: e.py[i], zugX: zug, zugY: zug })
  const reichweite = (i: number) => Math.max(e.zelle * 1.4, e.radien[i] * 3)
  const abstand = (aktiv: Iterable<number>) => ({ aktiv: new Set(aktiv), reichweite })
  const knaeuel = (staerke: number) => [...kette(e.kandidaten, e.zelle * 2.2, KNAEUEL * staerke, 1), ...kette(e.kandidaten, e.zelle * 2.2, 0.6 * KNAEUEL * staerke, 2)]
  switch (e.stufe) {
    case 'sammeln':
      // Alle zieht es in einen Punkt in der Mitte; das Netz schweigt.
      return { kanten: [], ziel: () => ({ x: mx, y: my, zugX: 0.12 * ein, zugY: 0.12 * ein }), abstand: null }
    case 'explosion': {
      // Der Anfangsstoss sprengt den Punkt, das Netz zieht die Wolke in ihre Form, der Zug heim
      // waechst nur so weit, dass die Wolke an ihrem Ort landet.
      const zug = HEIM + 0.06 * e.anteil * e.anteil
      return { kanten: [...netz], ziel: (i) => heim(i, zug), abstand: e.anteil > 0.3 ? abstand([]) : null }
    }
    case 'auswahl': {
      // Die Kandidaten bekommen eine staerkere Beziehung untereinander und wandern zur Mitte, auch
      // vom Rand der Wolke; ueber das Netz ziehen sie ihre aehnlichen Dokumente mit.
      const kand = new Set(e.kandidaten)
      return {
        kanten: [...netz, ...knaeuel(ein)],
        ziel: (i) => (kand.has(i) ? zusammen([e.px[i], e.py[i], HEIM, HEIM], [mx, my, ZUR_MITTE * ein, ZUR_MITTE * ein]) : heim(i, HEIM)),
        abstand: abstand(kand),
      }
    }
    case 'storyline': {
      // Die Belege: Reihenfolge und eine Achse in der Mitte. Das Knaeuel der Auswahl loest sich im
      // selben Mass, wie die Kette entsteht. Die Federn der Belege zur Wolke werden locker: Sie
      // ziehen ihre Nachbarn noch mit, halten sie aber nicht von der Achse fern.
      const { ys, zeile } = wolkenStoryline(e.belege.length, e.breite, e.hoehe)
      const platz = new Map(e.belege.map((i, k) => [i, ys[k]]))
      // Jeder Beleg hat seinen eigenen Einsatz: Sie loesen sich nacheinander aus dem Knaeuel.
      const je = new Map(e.belege.map((i, k) => [i, e.belegEin(k)]))
      const einVon = (i: number) => je.get(i) ?? 0
      const kand = new Set(e.kandidaten)
      const aus = 1 - ein
      // „Langsam und gemaechlich, aber bestimmt" (Owner 23.11.2026): Der Zug an den Platz waechst
      // weich an und endet stark; die Federn zur Wolke loesen sich ganz (ein Rest von 5 % hielt Belege
      // gemessen ~5 px neben ihrem Platz, die Titel warteten bis zur Hoechstzeit), die Kette haelt nur
      // noch locker zusammen — nichts zieht die Belege am Ende noch von der Achse.
      const locker = netz.map((k) => (platz.has(k.a) || platz.has(k.b) ? { ...k, staerke: k.staerke * (1 - einVon(k.a)) * (1 - einVon(k.b)) } : k))
      return {
        // Die Kette haelt erst zusammen, wenn alle unterwegs sind (der letzte Beleg gibt den Takt).
        kanten: [...locker, ...knaeuel(aus), ...kette(e.belege, zeile, 0.3 * e.belegEin(e.belege.length - 1), 1)],
        ziel: (i) => {
          const y = platz.get(i)
          if (y === undefined) {
            const zug = kand.has(i) ? ZUR_MITTE * aus : 0
            return zusammen([e.px[i], e.py[i], HEIM, HEIM], [mx, my, zug, zug])
          }
          // Bis zu seinem Einsatz bleibt der Beleg im Knaeuel der Mitte, dann zieht es ihn an den Platz.
          const an = einVon(i)
          return zusammen([mx, my, ZUR_MITTE * (1 - an), ZUR_MITTE * (1 - an)], [mx, y, ACHSE * an, ACHSE * an])
        },
        abstand: abstand(e.belege),
      }
    }
    case 'frei':
      // Alle Zusatzkraefte losgelassen: Das Netz findet von selbst in die Wolke zurueck. Der Zug an
      // den Ort waechst langsam, damit sie nicht verdreht oder gefaltet liegen bleibt.
      return { kanten: [...netz], ziel: (i) => heim(i, 0.01 + 0.09 * e.anteil), abstand: abstand([]) }
    default: {
      const unbekannt: never = e.stufe
      throw new Error(`Unbekannte Stufe der Wolke: ${String(unbekannt)}`)
    }
  }
}
