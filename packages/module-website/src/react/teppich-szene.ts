/**
 * Szene des Teppichs der Dokumente (Plan `teppich-der-dokumente`, T3).
 *
 * Haelt die Lage jedes Punkts ueber die Bilder hinweg und rechnet je Bild Ruhe, Schwarm, Flug
 * und Verzerrung. Steht eine Antwort, liegt jeder Beleg genau unter der Nummernmarke seiner
 * Karte; das Raster verzieht sich mit, Nachbarn folgen umso staerker, je naeher sie dem Beleg
 * sind (Owner 22.11.2026: Vorder- und Hintergrund deckungsgleich, das Muster wird unruhig).
 * Beim Erkunden (Karte ausgeblendet) und bei einer neuen Frage gleitet alles zurueck; dann
 * zeigt das Sternbild mit Ringen, woher die Belege kommen.
 */

import {
  FLUG_MS, driftVersatz, flugVerlauf, punktSaat, rasterVerzerrung, schwarmKreise, schwarmSchritt, schwarmStart,
  type TeppichPhase, type TeppichSchwarm,
} from '..'
import { markenPlatz, type TeppichSzenenStand } from './teppich-zeichnen'
import { zeichneTeppich } from './teppich-bild'

interface Flug { start: number; vonX: Float32Array; vonY: Float32Array; meldet: boolean }

export class TeppichSzene {
  hinten: HTMLCanvasElement | null = null
  /** Zeiger relativ zur Leinwand; der Schwarm folgt ihm. */
  zeiger: { x: number; y: number } | null = null
  private x = new Float32Array(0)
  private y = new Float32Array(0)
  private dx = new Float32Array(0)
  private dy = new Float32Array(0)
  private schwarm: TeppichSchwarm | null = null
  private flug: Flug | null = null
  private phase: TeppichPhase = 'ruhe'
  private mitte = { x: 0, y: 0 }
  private belegIndex: number[] = []
  /** Anteil der Verzerrung 0 (Raster) bis 1 (Belege unter ihren Marken). */
  private zug = 0
  /** Belege, deren Marke gerade im Bild ist. */
  private verankert = new Set<number>()
  /** T4: Kandidaten der Suche (Indizes) und ihre Kreise im Schwarm. */
  private kandidaten = new Set<number>()
  private kreis: Float32Array | undefined
  private kandidatenSchluessel = ''
  private stand: TeppichSzenenStand | null = null

  setze(s: TeppichSzenenStand): void {
    if (s.punkte.length !== this.x.length) {
      this.x = Float32Array.from(s.raster.px)
      this.y = Float32Array.from(s.raster.py)
      this.dx = new Float32Array(s.punkte.length)
      this.dy = new Float32Array(s.punkte.length)
      this.schwarm = null
      if (this.flug?.meldet) s.onGelandet()
      this.flug = null
    }
    const index = new Map(s.punkte.map((p, i) => [p.fileId, i]))
    this.belegIndex = s.belege.map((id) => index.get(id)).filter((i): i is number => i !== undefined)
    const schluessel = s.kandidaten.join('|')
    if (schluessel !== this.kandidatenSchluessel) {
      this.kandidatenSchluessel = schluessel
      this.kandidaten = new Set(s.kandidaten.map((id) => index.get(id)).filter((i): i is number => i !== undefined))
      this.kreis = schwarmKreise(s.punkte.length, this.kandidaten)
    }
    this.stand = s
  }

  /** Ein Bild: bewegen, dann zeichnen. `zeit` in ms (requestAnimationFrame), `dt` in s. */
  bild(zeit: number, dt: number): void {
    const s = this.stand
    const hinten = this.hinten
    if (!s || !hinten || s.breite === 0) return
    this.wechsle(s, zeit)
    this.bewege(s, zeit, dt, hinten.getBoundingClientRect())
    this.zeichne(s, zeit)
  }

  private wechsle(s: TeppichSzenenStand, zeit: number): void {
    if (s.phase === this.phase) return
    const vorher = this.phase
    this.phase = s.phase
    this.schwarm = s.phase === 'sucht' && s.bewegung ? schwarmStart(this.x, this.y) : null
    if (s.phase === 'sucht') { this.mitte = { x: s.breite / 2, y: s.hoehe / 2 }; this.zug = 0 }
    const zurueck = s.phase === 'ruhe' && vorher === 'sucht'
    this.flug = s.phase === 'landet' || zurueck
      ? { start: zeit, vonX: Float32Array.from(this.x), vonY: Float32Array.from(this.y), meldet: s.phase === 'landet' }
      : null
  }

  private heimat(s: TeppichSzenenStand, i: number, t: number): [number, number] {
    const { px, py, zelle } = s.raster
    if (!s.bewegung) return [px[i], py[i]]
    const [dx, dy] = driftVersatz(i, px[i], py[i], t, Math.max(1.2, Math.min(4, zelle * 0.3)), Math.max(1.4, Math.min(6, zelle * 0.45)))
    return [px[i] + dx, py[i] + dy]
  }

  /**
   * Verschiebung jedes Punkts, wenn die Belege unter ihren Marken liegen (`this.dx/dy`). Ein Beleg
   * ruekt genau auf seine Marke; jeder andere Punkt folgt den Belegen mit einem Gewicht, das mit dem
   * Abstand im Raster weich abfaellt. Gibt zurueck, ob es ueberhaupt etwas zu verziehen gibt.
   */
  private verziehe(s: TeppichSzenenStand, t: number, rect: DOMRect): boolean {
    this.dx.fill(0)
    this.dy.fill(0)
    this.verankert.clear()
    if (s.abgetaucht || (s.phase !== 'landet' && s.phase !== 'antwort')) return false
    const sektion = this.hinten?.closest('[data-website-story]')
    if (!sektion) return false
    const { px, py, zelle } = s.raster
    const anker: Array<{ i: number; dx: number; dy: number }> = []
    for (const i of this.belegIndex) {
      const platz = markenPlatz(sektion, rect, s.punkte[i].fileId)
      if (!platz) continue
      const [hx, hy] = this.heimat(s, i, t)
      anker.push({ i, dx: platz.x - hx, dy: platz.y - hy })
      this.verankert.add(i)
    }
    if (anker.length === 0) return false
    rasterVerzerrung(px, py, anker, Math.max(60, zelle * 3), this.dx, this.dy)
    return true
  }

  private bewege(s: TeppichSzenenStand, zeit: number, dt: number, rect: DOMRect): void {
    const t = zeit / 1000
    if (this.schwarm) {
      if (this.zeiger) {
        const gx = Math.min(0.75 * s.breite, Math.max(0.25 * s.breite, this.zeiger.x))
        const gy = Math.min(0.68 * s.hoehe, Math.max(0.32 * s.hoehe, this.zeiger.y))
        this.mitte.x += (gx - this.mitte.x) * Math.min(1, dt * 2.5)
        this.mitte.y += (gy - this.mitte.y) * Math.min(1, dt * 2.5)
      }
      schwarmSchritt(this.schwarm, dt, t, this.mitte, s.breite, s.hoehe, this.kreis)
      this.x.set(this.schwarm.x)
      this.y.set(this.schwarm.y)
      return
    }
    const verzogen = this.verziehe(s, t, rect)
    if (this.flug) {
      const f = this.flug
      let fertig = true
      for (let i = 0; i < this.x.length; i++) {
        const [hx, hy] = this.heimat(s, i, t)
        const k = this.belegIndex.indexOf(i)
        // T4: Belege fliegen erst in den engen Kreis der Mitte (definitiv verwendet), dann unter ihre Marke.
        const zweistufig = f.meldet && k >= 0
        const verzug = k >= 0 ? k * 70 : punktSaat(i) * 250
        const p = s.bewegung ? (zeit - f.start - verzug) / (zweistufig ? FLUG_MS * 2 : FLUG_MS) : 1
        if (p < 1) fertig = false
        let [vx, vy, q] = [f.vonX[i], f.vonY[i], p]
        if (zweistufig) {
          const w = (k / this.belegIndex.length) * 6.2832
          const rr = 0.12 * Math.min(s.breite, s.hoehe)
          const [mx, my] = [this.mitte.x + Math.cos(w) * rr, this.mitte.y + Math.sin(w) * rr]
          if (p < 0.5) { const e = flugVerlauf(p * 2); this.x[i] = vx + (mx - vx) * e; this.y[i] = vy + (my - vy) * e; continue }
          ;[vx, vy, q] = [mx, my, (p - 0.5) * 2]
        }
        const e = flugVerlauf(q)
        this.x[i] = vx + (hx + this.dx[i] - vx) * e
        this.y[i] = vy + (hy + this.dy[i] - vy) * e
      }
      if (fertig) {
        this.flug = null
        this.zug = f.meldet && verzogen ? 1 : 0
        if (f.meldet) s.onGelandet()
      }
      return
    }
    const ziel = verzogen ? 1 : 0
    this.zug = s.bewegung ? this.zug + (ziel - this.zug) * Math.min(1, dt * 3) : ziel
    for (let i = 0; i < this.x.length; i++) {
      const [hx, hy] = this.heimat(s, i, t)
      // Ohne Verzerrung bleibt die zuletzt gerechnete Verschiebung stehen, bis `zug` bei 0 ist.
      this.x[i] = hx + this.dx[i] * this.zug
      this.y[i] = hy + this.dy[i] * this.zug
    }
  }

  private zeichne(s: TeppichSzenenStand, zeit: number): void {
    if (!this.hinten) return
    const t = zeit / 1000
    zeichneTeppich(this.hinten, s, {
      x: this.x, y: this.y, belegIndex: this.belegIndex, kandidaten: this.kandidaten,
      verankert: this.verankert, zug: this.zug, heimat: (i) => this.heimat(s, i, t),
    })
  }
}
