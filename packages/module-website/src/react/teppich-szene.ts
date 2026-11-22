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
  FLUG_MS, driftVersatz, flugVerlauf, punktSaat, rasterVerzerrung, schwarmSchritt, schwarmStart,
  type TeppichPhase, type TeppichSchwarm,
} from '..'
import { leinwandBereit, markenPlatz, zeichneFaden, zeichnePunkte, zeichneRinge, type TeppichSzenenStand } from './teppich-zeichnen'

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
      schwarmSchritt(this.schwarm, dt, t, this.mitte, s.breite, s.hoehe)
      this.x.set(this.schwarm.x)
      this.y.set(this.schwarm.y)
      return
    }
    const verzogen = this.verziehe(s, t, rect)
    if (this.flug) {
      const f = this.flug
      const belege = new Set(this.belegIndex)
      let fertig = true
      for (let i = 0; i < this.x.length; i++) {
        const [hx, hy] = this.heimat(s, i, t)
        const verzug = belege.has(i) ? this.belegIndex.indexOf(i) * 70 : punktSaat(i) * 250
        const p = s.bewegung ? (zeit - f.start - verzug) / FLUG_MS : 1
        if (p < 1) fertig = false
        const e = flugVerlauf(p)
        this.x[i] = f.vonX[i] + (hx + this.dx[i] - f.vonX[i]) * e
        this.y[i] = f.vonY[i] + (hy + this.dy[i] - f.vonY[i]) * e
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
    const ctx = this.hinten ? leinwandBereit(this.hinten, s.breite, s.hoehe) : null
    if (!ctx) return
    const antwort = s.phase === 'landet' || s.phase === 'antwort'
    const belege = new Set(antwort ? this.belegIndex : [])
    const ruhig = s.phase === 'ruhe' || s.phase === 'antwort'
    ctx.clearRect(0, 0, s.breite, s.hoehe)
    ctx.fillStyle = s.farbe
    ctx.strokeStyle = s.farbe
    // Owner 22.11.2026: gross und blass.
    ctx.globalAlpha = s.phase === 'sucht' ? 0.22 : s.abgetaucht ? 0.32 : 0.15
    zeichnePunkte(ctx, this.x, this.y, s.radien, (i) => !belege.has(i))
    if (ruhig) {
      ctx.globalAlpha = 0.7
      ctx.font = '11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      for (const m of s.raster.jahrMarken) ctx.fillText(String(m.jahr), m.x, s.hoehe - 6)
    }
    if (antwort && belege.size > 0) {
      // Beim Erkunden: das Sternbild der Belege an ihren festen Plaetzen, mit Ring und Nummer.
      if (s.abgetaucht && s.phase === 'antwort') {
        const t = zeit / 1000
        const heim = this.belegIndex.map((i, k) => { const [x, y] = this.heimat(s, i, t); return { x, y, r: s.radien[i], nummer: k + 1 } })
        ctx.globalAlpha = 0.3
        zeichneFaden(ctx, heim)
        ctx.globalAlpha = 0.85
        zeichneRinge(ctx, heim)
      }
      // Unter den Marken: der Faden nur, wo die Karten eine Spalte bilden (kein Zickzack im Raster).
      if (!s.abgetaucht && this.zug > 0.5) {
        const lage = this.belegIndex.filter((i) => this.verankert.has(i)).map((i) => ({ x: this.x[i], y: this.y[i] }))
        const xs = lage.map((p) => p.x)
        ctx.globalAlpha = 0.6
        if (lage.length > 1 && Math.max(...xs) - Math.min(...xs) < 16) zeichneFaden(ctx, lage)
      }
      ctx.globalAlpha = 0.7
      zeichnePunkte(ctx, this.x, this.y, s.radien, (i) => belege.has(i), 1.3)
    }
    if (ruhig && s.ueber >= 0 && s.ueber < this.x.length) {
      ctx.globalAlpha = 1
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(this.x[s.ueber], this.y[s.ueber], s.radien[s.ueber] + 4, 0, 6.2832)
      ctx.stroke()
    }
  }
}
