/**
 * Animation `wolke` des Teppichs (Plan `teppich-der-dokumente` §3.6, T5d, Owner 23.11.2026).
 *
 * Grundsatz: eine Physik, ein Bewegungsmuster — keine berechneten Fluege. Es laeuft EINE
 * Simulation (`d3-force`); die Stufen aendern nur ihre Kraefte (`teppich-wolken-kraefte.ts`):
 *
 * 1. `sammeln` — Frage abgeschickt: alle Punkte ziehen sich in einen Punkt in der Mitte.
 * 2. `explosion` — der Punkt explodiert, die Wolke bildet sich vor den Augen; der Zug heim waechst,
 *    bis jeder Punkt wieder an seinem Platz ist.
 * 3. `auswahl` — Auswahl der Suche bekannt: Die Kandidaten bekommen neue Beziehungen und wandern
 *    als Knaeuel zusammen.
 * 4. `storyline` — Belege bekannt: Jeder haengt am vorhergehenden, alle zieht es auf eine Achse.
 *    Erst wenn die Bewegung abgeklungen ist (hoechstens `HOECHSTENS_MS`), kommen die Titel; nach
 *    `STORYLINE_MS` gilt die Storyline als gelandet.
 * 5. `heim` — Antwort steht: Jeder bewegte Punkt kehrt an seinen Platz zurueck, dann endet sie.
 *
 * Punkte, die daheim sind und nichts mehr zu tun haben, rechnen nicht mehr mit.
 */

import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import { STORYLINE_MS, punktSaat, type TeppichPhase } from '..'
import { wolkenKraefte, type WolkenStufe } from './teppich-wolken-kraefte'

interface Knoten extends SimulationNodeDatum { i: number }
type Kante = SimulationLinkDatum<Knoten> & { abstand: number; staerke: number }

const SAMMELN_MS = 700
const EXPLOSION_MS = 2600
const HOECHSTENS_MS = 4500
const RUHE_ALPHA = 0.04
const DAHEIM_PX = 0.8
const AUSDUENNEN_MS = 400

export interface WolkenSchrittEingabe {
  phase: TeppichPhase
  zeit: number
  breite: number
  hoehe: number
  zelle: number
  radien: Float32Array
  px: Float32Array
  py: Float32Array
  nachbarn: (i: number) => readonly number[]
  kandidaten: readonly number[]
  belege: readonly number[]
  onGelandet: () => void
}

export class TeppichWolkenPhysik {
  /** Anteil 0..1 der eingeblendeten Titel der Storyline. */
  titel = 0
  private sim: Simulation<Knoten, Kante> | null = null
  private knoten = new Map<number, Knoten>()
  private schluessel = ''
  private phase: TeppichPhase = 'ruhe'
  private frageSeit = 0
  private stufeSeit = 0
  private ausgeduennt = 0
  private ruhigSeit: number | null = null
  private gemeldet = false

  get aktiv(): boolean { return this.sim !== null }

  /** Ein Bild: Stufe bestimmen, Kraefte bei Bedarf neu setzen, rechnen, Lagen nach `x`/`y`. */
  schritt(e: WolkenSchrittEingabe, x: Float32Array, y: Float32Array): void {
    if (e.phase === 'sucht' && this.phase !== 'sucht') this.frageSeit = e.zeit
    this.phase = e.phase
    const seit = e.zeit - this.frageSeit
    const stufe = this.stufe(e, seit)
    if (stufe === null) { if (this.sim) this.beenden(); this.titel = 0; return }

    const schluessel = `${stufe}|${e.kandidaten.join(',')}|${e.belege.join(',')}|${e.breite}x${e.hoehe}`
    if (schluessel !== this.schluessel) {
      this.schluessel = schluessel
      this.stufeSeit = e.zeit
      const alle = stufe === 'sammeln' || (stufe === 'explosion' && this.knoten.size < e.px.length)
      this.aufbauen(e, stufe, alle ? Array.from({ length: e.px.length }, (_, i) => i) : [...this.knoten.keys(), ...e.kandidaten, ...e.belege], x, y, seit)
    } else if (stufe === 'explosion' && seit < SAMMELN_MS + EXPLOSION_MS) {
      this.ziele(e, stufe, seit) // der Zug heim waechst mit jedem Bild
    } else if (e.zeit - this.ausgeduennt > AUSDUENNEN_MS) {
      this.ausduennen(e, stufe, x, y, seit)
    }
    const sim = this.sim
    if (!sim) return
    sim.tick()
    for (const k of this.knoten.values()) { x[k.i] = k.x ?? x[k.i]; y[k.i] = k.y ?? y[k.i] }
    if (stufe === 'heim' && this.knoten.size === 0) this.beenden()
    this.storyline(e, stufe)
  }

  private stufe(e: WolkenSchrittEingabe, seit: number): WolkenStufe | null {
    if (e.phase === 'sucht') {
      if (seit < SAMMELN_MS) return 'sammeln'
      if (seit < SAMMELN_MS + EXPLOSION_MS || e.kandidaten.length === 0) return 'explosion'
      return 'auswahl'
    }
    if (e.phase === 'landet') return 'storyline'
    return this.sim ? 'heim' : null
  }

  private eingabe(e: WolkenSchrittEingabe, stufe: WolkenStufe, seit: number) {
    return {
      stufe, breite: e.breite, hoehe: e.hoehe, zelle: e.zelle, px: e.px, py: e.py, nachbarn: e.nachbarn,
      kandidaten: e.kandidaten, belege: e.belege,
      explosionsAnteil: Math.min(1, Math.max(0, (seit - SAMMELN_MS) / EXPLOSION_MS)),
    }
  }

  /** Neue Simulation fuer `beteiligt`; Lage und Schwung bleiben erhalten. */
  private aufbauen(e: WolkenSchrittEingabe, stufe: WolkenStufe, beteiligt: readonly number[], x: Float32Array, y: Float32Array, seit: number): void {
    const neu = new Map<number, Knoten>()
    for (const i of new Set(beteiligt)) {
      const alt = this.knoten.get(i)
      // Beim Explodieren liegen alle fast auf einem Punkt; ein winziger, fester Versatz gibt die Richtung.
      const w = punktSaat(i) * 6.2832
      const start = stufe === 'explosion' && !alt ? { x: x[i] + Math.cos(w) * 0.5, y: y[i] + Math.sin(w) * 0.5 } : { x: alt?.x ?? x[i], y: alt?.y ?? y[i] }
      neu.set(i, { i, ...start, vx: alt?.vx ?? 0, vy: alt?.vy ?? 0 })
    }
    this.knoten = neu
    this.sim?.stop()
    this.sim = forceSimulation<Knoten, Kante>([...neu.values()]).alphaDecay(stufe === 'explosion' ? 0.008 : 0.02).velocityDecay(0.35).stop()
    this.ziele(e, stufe, seit)
    // Beim Heimkehren bleibt Energie im System, sonst erstarren die Punkte kurz vor ihrem Platz.
    this.sim.alpha(1).alphaTarget(stufe === 'explosion' || stufe === 'heim' ? 0.25 : 0)
    if (stufe === 'storyline') { this.gemeldet = false; this.ruhigSeit = null; this.titel = 0 }
  }

  /** Kraefte der Stufe an die laufende Simulation haengen. */
  private ziele(e: WolkenSchrittEingabe, stufe: WolkenStufe, seit: number): void {
    const sim = this.sim
    if (!sim) return
    const kr = wolkenKraefte(this.eingabe(e, stufe, seit), [...this.knoten.keys()])
    const da = this.knoten
    const kanten: Kante[] = kr.kanten.filter((k) => da.has(k.a) && da.has(k.b)).map((k) => ({ source: k.a, target: k.b, abstand: k.abstand, staerke: k.staerke }))
    sim.force('kette', forceLink<Knoten, Kante>(kanten).id((k) => k.i).distance((l) => l.abstand).strength((l) => l.staerke))
    sim.force('abstossung', kr.abstossung < 0 ? forceManyBody<Knoten>().strength(kr.abstossung).distanceMax(e.zelle * 10) : null)
    sim.force('kollision', kr.kollision ? forceCollide<Knoten>((k) => e.radien[k.i] * 1.3 + 1) : null)
    sim.force('x', forceX<Knoten>((k) => kr.ziel(k.i).x).strength((k) => kr.ziel(k.i).zugX))
    sim.force('y', forceY<Knoten>((k) => kr.ziel(k.i).y).strength((k) => kr.ziel(k.i).zugY))
  }

  /** Wer daheim ist und nichts mehr zu tun hat, rechnet nicht mehr mit. */
  private ausduennen(e: WolkenSchrittEingabe, stufe: WolkenStufe, x: Float32Array, y: Float32Array, seit: number): void {
    this.ausgeduennt = e.zeit
    const bleiben = new Set(stufe === 'auswahl' ? e.kandidaten : stufe === 'storyline' ? e.belege : [])
    const fertig = [...this.knoten.values()].filter((k) => !bleiben.has(k.i) && Math.hypot((k.x ?? 0) - e.px[k.i], (k.y ?? 0) - e.py[k.i]) < DAHEIM_PX)
    if (fertig.length === 0) return
    for (const k of fertig) this.knoten.delete(k.i)
    const alpha = this.sim?.alpha() ?? 1
    this.aufbauen(e, stufe, [...this.knoten.keys()], x, y, seit)
    this.sim?.alpha(alpha)
  }

  private beenden(): void {
    this.sim?.stop()
    this.sim = null
    this.knoten.clear()
    this.schluessel = ''
  }

  /** Titel erst, wenn die Kette steht; danach `STORYLINE_MS` zum Lesen, dann gelandet. */
  private storyline(e: WolkenSchrittEingabe, stufe: WolkenStufe): void {
    if (stufe !== 'storyline') { this.titel = 0; return }
    const steht = (this.sim?.alpha() ?? 0) < RUHE_ALPHA * 2 || e.zeit - this.stufeSeit > HOECHSTENS_MS
    if (steht && this.ruhigSeit === null) this.ruhigSeit = e.zeit
    this.titel = this.ruhigSeit === null ? 0 : Math.min(1, (e.zeit - this.ruhigSeit) / 400)
    if (this.ruhigSeit !== null && !this.gemeldet && e.zeit - this.ruhigSeit >= STORYLINE_MS) {
      this.gemeldet = true
      e.onGelandet()
    }
  }
}
