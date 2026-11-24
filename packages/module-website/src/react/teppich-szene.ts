/**
 * Szene des Teppichs der Dokumente (Plan `teppich-der-dokumente`, T3/T4).
 *
 * Haelt die Lage jedes Punkts ueber die Bilder hinweg. Ablauf einer Frage (Owner 22.11.2026):
 * Die Punkte loesen sich aus der Wolke und schwaermen; die Auswahl der Suche zieht auf einen
 * inneren Kreis. Mit der Antwort verdichten sich die zitierten Belege: erst in einen engen Kreis
 * der Mitte, dann zur Storyline — eine Liste in der Bildmitte, in der Reihenfolge der Antwort, mit
 * Nummer und Titel. Sie steht einen Moment, dann erscheint die Antwort, und alle Punkte fliegen an
 * ihren Platz in der Wolke zurueck — kein Kreisen hinter der Antwort (Owner 23.11.2026).
 */

import {
  FLUG_MS, STORYLINE_MS, driftVersatz, flugVerlauf, punktSaat, schwarmKreise, schwarmSchritt, schwarmStart, storylineLage,
  type TeppichPhase, type TeppichSchwarm,
} from '..'
import type { TeppichSzenenStand } from './teppich-zeichnen'
import { zeichneTeppich } from './teppich-bild'
import { TeppichWolkenBuehne } from './teppich-wolken-buehne'

interface Flug { start: number; vonX: Float32Array; vonY: Float32Array }
interface Verdichtung extends Flug { listeSeit: number | null; gemeldet: boolean }

export class TeppichSzene {
  hinten: HTMLCanvasElement | null = null
  /** Zeiger relativ zur Leinwand; der Schwarm folgt ihm waehrend der Suche. */
  zeiger: { x: number; y: number } | null = null
  /** Graph-Ansicht: Vergroesserung und Ausschnitt (`useTeppichSicht`); sonst die Einheit. */
  sicht: { z: number; x: number; y: number } = { z: 1, x: 0, y: 0 }
  private x = new Float32Array(0)
  private y = new Float32Array(0)

  /** Aktuelle Lage der Punkte (Pixel), etwa fuer Treffer beim Ueberfahren. */
  get lage(): { x: Float32Array; y: Float32Array } { return { x: this.x, y: this.y } }
  private schwarm: TeppichSchwarm | null = null
  private rueckflug: Flug | null = null
  private verdichtung: Verdichtung | null = null
  /** Anteil 0..1, wie weit die Titel der Storyline eingeblendet sind. */
  private titel = 0
  private phase: TeppichPhase = 'ruhe'; private mitte = { x: 0, y: 0 }
  private belegIndex: number[] = []
  private kandidaten = new Set<number>()
  private kreis: Float32Array | undefined; private kreisSchluessel = ''
  private standPhase: TeppichPhase = 'ruhe'
  private stand: TeppichSzenenStand | null = null
  /** Animation `wolke` (Parameter `animation=wolke`): durchgehend Physik statt Schwarm und Flug. */
  private wolke = new TeppichWolkenBuehne()

  /** Wolke: Punkt `i` an die Stelle (`x`, `y`) der Leinwand ziehen; das Netz zieht seine Nachbarn mit. */
  zieh(i: number, x: number, y: number): void { this.wolke.zieh(i, x, y) }
  lasse(): void { this.wolke.lasse() }
  setze(s: TeppichSzenenStand): void {
    if (s.punkte.length !== this.x.length) {
      this.x = Float32Array.from(s.plaetze.px)
      this.y = Float32Array.from(s.plaetze.py)
      this.schwarm = null
      this.rueckflug = null
      if (this.verdichtung && !this.verdichtung.gemeldet) s.onGelandet()
      this.verdichtung = null
    }
    const index = new Map(s.punkte.map((p, i) => [p.fileId, i]))
    const nachIndex = (ids: readonly string[]) => ids.map((id) => index.get(id)).filter((i): i is number => i !== undefined)
    this.belegIndex = nachIndex(s.belege)
    const schluessel = `${s.kandidaten.join('|')}#${s.belege.join('|')}`
    const neueFrage = s.phase === 'sucht' && this.standPhase !== 'sucht'
    this.standPhase = s.phase
    if (schluessel !== this.kreisSchluessel || neueFrage) {
      this.kreisSchluessel = schluessel
      const gemeldet = new Set(nachIndex(s.kandidaten))
      // Wolke (Owner 23.11.2026): Die erste Auswahl bleibt bis zur naechsten Frage markiert — die
      // Seite meldet sie nicht mehr, sobald die Antwort da ist, und sie ging auf einen Schlag verloren.
      if (s.animation !== 'wolke' || gemeldet.size > 0 || neueFrage || s.phase === 'ruhe') this.kandidaten = gemeldet
      this.kreis = schwarmKreise(s.punkte.length, this.kandidaten, new Set(this.belegIndex))
    }
    this.stand = s
  }

  /** Ein Bild: bewegen, dann zeichnen. `zeit` in ms (requestAnimationFrame), `dt` in s. */
  bild(zeit: number, dt: number): void {
    const s = this.stand
    if (!s || !this.hinten || s.breite === 0) return
    const t = zeit / 1000
    const wolke = s.animation === 'wolke' && s.bewegung
    if (wolke) this.wolkeBild(s, zeit, t)
    else {
      this.wechsle(s, zeit)
      this.bewege(s, zeit, dt)
      this.verdichte(s, zeit)
    }
    zeichneTeppich(this.hinten, s, {
      x: this.x, y: this.y, sicht: this.sicht, belegIndex: this.belegIndex, kandidaten: this.kandidaten,
      // In der Wolke gehoeren die Lagen der Physik: Ringe und Linien stehen dort, wo die Punkte sind.
      daheim: wolke ? s.phase === 'ruhe' || s.phase === 'antwort' : !this.schwarm,
      titel: wolke ? this.wolke.titel : this.titel,
      uebergang: wolke ? this.wolke.uebergang : 1,
      kandStaerke: wolke ? this.wolke.staerke : () => 1,
      belegMarke: wolke ? this.wolke.belegMarke : () => 1,
      heimat: wolke ? (i) => [this.x[i], this.y[i]] : (i) => this.heimat(s, i, t),
    })
  }

  /** Animation `wolke`: alle an ihrem Platz (mit Schweben), die bewegten Punkte rechnet die Physik. */
  private wolkeBild(s: TeppichSzenenStand, zeit: number, t: number): void {
    this.phase = s.phase
    for (let i = 0; i < this.x.length; i++) {
      const [hx, hy] = this.heimat(s, i, t)
      this.x[i] = hx; this.y[i] = hy
    }
    this.wolke.schritt(s, zeit, this.kandidaten, this.belegIndex, this.x, this.y)
  }

  private wechsle(s: TeppichSzenenStand, zeit: number): void {
    if (s.phase === this.phase) return
    const vorher = this.phase
    this.phase = s.phase
    if (s.phase === 'sucht') this.mitte = { x: s.breite / 2, y: s.hoehe / 2 }
    if (s.phase === 'landet') {
      this.verdichtung = { start: zeit, vonX: Float32Array.from(this.x), vonY: Float32Array.from(this.y), listeSeit: null, gemeldet: false }
    } else if (vorher === 'landet') {
      // Die Belege fliegen aus der Storyline heraus an ihren Platz (Rueckflug in `bewege`).
      this.verdichtung = null
      this.titel = 0
    }
  }

  private heimat(s: TeppichSzenenStand, i: number, t: number): [number, number] {
    const { px, py, zelle } = s.plaetze
    if (!s.bewegung) return [px[i], py[i]]
    const [dx, dy] = driftVersatz(i, px[i], py[i], t, Math.max(1.2, Math.min(4, zelle * 0.3)), Math.max(1.4, Math.min(6, zelle * 0.45)))
    return [px[i] + dx, py[i] + dy]
  }

  /** Schwarm in Suche und Verdichtung; feste Plaetze in Ruhe, bei der Antwort und beim Erkunden. */
  private bewege(s: TeppichSzenenStand, zeit: number, dt: number): void {
    const t = zeit / 1000
    const schwaermt = s.bewegung && (s.phase === 'sucht' || (s.phase === 'landet' && !s.abgetaucht))
    if (schwaermt) {
      if (!this.schwarm) { this.schwarm = schwarmStart(this.x, this.y); this.rueckflug = null }
      if (s.phase === 'sucht' && this.zeiger) {
        // Die Mitte des Schwarms folgt dem Zeiger, bleibt aber in der inneren Haelfte des Kastens.
        const k = s.kasten
        const gx = Math.min(k.links + 0.75 * k.breite, Math.max(k.links + 0.25 * k.breite, this.zeiger.x))
        const gy = Math.min(0.68 * s.hoehe, Math.max(0.32 * s.hoehe, this.zeiger.y))
        this.mitte.x += (gx - this.mitte.x) * Math.min(1, dt * 2.5)
        this.mitte.y += (gy - this.mitte.y) * Math.min(1, dt * 2.5)
      }
      schwarmSchritt(this.schwarm, dt, t, this.mitte, s.kasten.breite, s.hoehe, this.kreis)
      this.x.set(this.schwarm.x)
      this.y.set(this.schwarm.y)
      return
    }
    if (this.schwarm) {
      this.schwarm = null
      this.rueckflug = { start: zeit, vonX: Float32Array.from(this.x), vonY: Float32Array.from(this.y) }
    }
    const f = this.rueckflug
    let fertig = true
    for (let i = 0; i < this.x.length; i++) {
      const [hx, hy] = this.heimat(s, i, t)
      if (!f) { this.x[i] = hx; this.y[i] = hy; continue }
      const p = s.bewegung ? (zeit - f.start - punktSaat(i) * 250) / FLUG_MS : 1
      if (p < 1) fertig = false
      const e = flugVerlauf(p)
      this.x[i] = f.vonX[i] + (hx - f.vonX[i]) * e
      this.y[i] = f.vonY[i] + (hy - f.vonY[i]) * e
    }
    if (f && fertig) this.rueckflug = null
  }

  /** Verdichtung: Belege erst in den engen Kreis der Mitte, dann in die Storyline; danach steht sie. */
  private verdichte(s: TeppichSzenenStand, zeit: number): void {
    const v = this.verdichtung
    if (s.phase !== 'landet' || !v) return
    const n = this.belegIndex.length
    const { x: lx, ys } = storylineLage(n, s.breite, s.hoehe)
    const rr = 0.1 * Math.min(s.breite, s.hoehe)
    let fertig = true
    this.belegIndex.forEach((i, k) => {
      const p = s.bewegung ? (zeit - v.start - k * 90) / (FLUG_MS * 2) : 1
      if (p < 1) fertig = false
      const w = (k / Math.max(1, n)) * 6.2832
      const mx = this.mitte.x + Math.cos(w) * rr
      const my = this.mitte.y + Math.sin(w) * rr
      if (p < 0.5) {
        const e = flugVerlauf(p * 2)
        this.x[i] = v.vonX[i] + (mx - v.vonX[i]) * e
        this.y[i] = v.vonY[i] + (my - v.vonY[i]) * e
      } else {
        const e = flugVerlauf((p - 0.5) * 2)
        this.x[i] = mx + (lx - mx) * e
        this.y[i] = my + (ys[k] - my) * e
      }
    })
    if (fertig && v.listeSeit === null) v.listeSeit = zeit
    this.titel = v.listeSeit === null ? 0 : Math.min(1, (zeit - v.listeSeit) / 400)
    if (v.listeSeit !== null && !v.gemeldet && zeit - v.listeSeit >= STORYLINE_MS) {
      v.gemeldet = true
      s.onGelandet()
    }
  }
}
