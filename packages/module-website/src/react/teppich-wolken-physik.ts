/**
 * Animation `wolke` des Teppichs (Plan `teppich-der-dokumente` §3.6, T5d, Owner 23.11.2026).
 *
 * Grundsatz: eine Physik, ein Bewegungsmuster. EINE Simulation (`d3-force`) mit ALLEN Punkten,
 * verbunden zu einem elastischen Netz (`wolkenNetz`); die Stufen aendern nur die Zusatzkraefte
 * (`teppich-wolken-kraefte.ts`). Ein Zyklus je Frage, der immer wieder in die Wolke muendet:
 *
 * `sammeln` (alle in einen Punkt) → `explosion` (Stoss, das Netz formt die Wolke) → `auswahl`
 * (Kandidaten zur Mitte, das Netz zieht mit) → `storyline` (Belege als Kette auf der Achse; Titel,
 * sobald sie steht; nach `STORYLINE_MS` gelandet) → `frei` (alles losgelassen, zurueck in die Wolke).
 * Weich statt ruckartig: ein Rechenschritt je `TAKT_MS`, dazwischen ueberblendet (`teppich-wolken-takt.ts`).
 */

import { forceLink, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import { STORYLINE_MS, type TeppichPhase } from '..'
import { wolkenKraefte, wolkenNetz, type WolkenKante, type WolkenStufe, type WolkenZiel } from './teppich-wolken-kraefte'
import { abstandsKraft, explosionsStoss } from './teppich-wolken-stoss'
import { BELEG_MARKE_MS, BELEG_TAKT_MS, EINBLENDEN_MS, EXPLOSION_MS, HOECHSTENS_MS, LOSLASSEN_MS, AM_PLATZ, SAMMELN_MS, SCHLAF_ALPHA, TAKT_MS, weich, type WolkenSchrittEingabe } from './teppich-wolken-takt'

export type { WolkenSchrittEingabe } from './teppich-wolken-takt'

interface Knoten extends SimulationNodeDatum { i: number }
type Kante = SimulationLinkDatum<Knoten> & { abstand: number; staerke: number }


export class TeppichWolkenPhysik {
  /** Anteil 0..1 der eingeblendeten Titel der Storyline. */
  titel = 0
  private sim: Simulation<Knoten, Kante> | null = null
  private knoten: Knoten[] = []
  private netz: WolkenKante[] = []
  private ziele: WolkenZiel[] = []
  private netzFuer: Float32Array | null = null
  /** Anteil 0..1, wie weit die Storyline das Knaeuel der Auswahl abgeloest hat (fuer die Zeichnung). */
  uebergang = 0
  private jetzt = 0
  private gezogen: { i: number; x: number; y: number } | null = null
  private stufeJetzt: WolkenStufe | null = null
  private schluessel = ''
  private masse = ''
  private phase: TeppichPhase = 'ruhe'
  private frageSeit = 0
  private stufeSeit = 0
  private taktSeit = Number.NEGATIVE_INFINITY
  private altX = new Float32Array(0)
  private altY = new Float32Array(0)
  private ruhigSeit: number | null = null
  private gemeldet = false

  /** Storyline: wie weit der `k`-te Beleg schon an seinen Platz zieht (0..1); sie setzen im Takt ein. */
  belegEin = (k: number): number => (this.stufeJetzt === 'storyline' ? weich((this.jetzt - this.stufeSeit - k * BELEG_TAKT_MS) / EINBLENDEN_MS.storyline) : 0)
  /** Storyline: wie weit der `k`-te Beleg als gewaehlt markiert ist (0..1, schnell). */
  belegMarke = (k: number): number => (this.stufeJetzt === 'storyline' ? Math.min(1, Math.max(0, (this.jetzt - this.stufeSeit - k * BELEG_TAKT_MS) / BELEG_MARKE_MS)) : 0)

  /** Punkt `i` an (`x`, `y`) festhalten (Ziehen mit der Maus), bis `lasse()` ihn freigibt. */
  zieh(i: number, x: number, y: number): void { if (i >= 0) this.gezogen = { i, x, y } }
  lasse(): void {
    const k = this.gezogen ? this.knoten[this.gezogen.i] : undefined
    if (k) { k.fx = null; k.fy = null }
    this.gezogen = null; this.stufeSeit = this.jetzt; this.sim?.alphaTarget(0.25) // der Zug heim waechst neu an
  }

  /** Laeuft die Physik? Dann gehoeren die Lagen ihr, nicht den festen Plaetzen. */
  get aktiv(): boolean { return this.sim !== null }

  /** Ein Bild: Stufe bestimmen, im Takt rechnen, dazwischen ueberblenden, Lagen nach `x`/`y`. */
  schritt(e: WolkenSchrittEingabe, x: Float32Array, y: Float32Array): void {
    if (e.phase === 'sucht' && this.phase !== 'sucht') this.frageSeit = e.zeit
    this.phase = e.phase
    const seit = e.zeit - this.frageSeit
    const stufe = this.stufe(e, seit)
    if (stufe === null) { this.titel = 0; return }

    if (this.knoten.length !== e.px.length) this.neu(e, x, y)
    const sim = this.sim
    if (!sim) return
    // Die Flaeche aendert beim Fragen mehrmals ihre Hoehe (gemessen 23.11.2026: 4 Mal in gut einer
    // Sekunde). Das ist kein neuer Abschnitt: nur die Ziele verschieben sich, die Punkte gleiten hin.
    const neueMasse = this.netzFuer !== e.px || this.masse !== `${e.breite}x${e.hoehe}`
    if (this.netzFuer !== e.px) { this.netz = wolkenNetz(e); this.netzFuer = e.px }
    this.masse = `${e.breite}x${e.hoehe}`
    // Neue Stufe nur beim echten Wechsel. Kommen Kandidaten nach (sie treffen nach und nach ein),
    // aendern sich nur die Kraefte: kein neuer Stoss, kein neues Einblenden ab null.
    const liste = `${e.kandidaten.join(',')}|${e.belege.join(',')}`
    if (stufe !== this.stufeJetzt) {
      this.stufeJetzt = stufe
      this.schluessel = liste
      this.stufeSeit = e.zeit
      this.wechsle(e, stufe, seit)
    } else if (neueMasse || liste !== this.schluessel) {
      this.schluessel = liste
      this.kraefte(e, stufe, seit)
    }
    this.jetzt = e.zeit
    this.uebergang = stufe === 'storyline' ? weich((e.zeit - this.stufeSeit) / EINBLENDEN_MS.storyline) : 0
    if (e.zeit - this.taktSeit >= TAKT_MS) {
      // Zurueckgefallen (Tab im Hintergrund): nicht nachholen, im Takt weiter.
      this.taktSeit = e.zeit - this.taktSeit > 2 * TAKT_MS ? e.zeit : this.taktSeit + TAKT_MS
      if (this.waechst(e, stufe, seit)) this.kraefte(e, stufe, seit)
      // Nach dem Loslassen darf die Energie abklingen; dann ruht die Rechnung.
      else if (stufe === 'frei' && sim.alphaTarget() > 0) sim.alphaTarget(0)
      for (const k of this.knoten) { this.altX[k.i] = k.x ?? 0; this.altY[k.i] = k.y ?? 0 }
      // Gezogen: der Punkt steht am Zeiger, die Rechnung bleibt wach, das Netz zieht die Nachbarn mit.
      if (this.gezogen) { const k = this.knoten[this.gezogen.i]; k.fx = this.gezogen.x; k.fy = this.gezogen.y; sim.alphaTarget(0.3).alpha(Math.max(sim.alpha(), 0.15)) }
      if (stufe !== 'frei' || sim.alpha() > SCHLAF_ALPHA) sim.tick()
    }
    const f = Math.min(1, (e.zeit - this.taktSeit) / TAKT_MS)
    for (const k of this.knoten) {
      x[k.i] = this.altX[k.i] + ((k.x ?? 0) - this.altX[k.i]) * f
      y[k.i] = this.altY[k.i] + ((k.y ?? 0) - this.altY[k.i]) * f
    }
    this.storyline(e, stufe)
  }

  private stufe(e: WolkenSchrittEingabe, seit: number): WolkenStufe | null {
    if (e.phase === 'sucht') {
      if (seit < SAMMELN_MS) return 'sammeln'
      if (seit < SAMMELN_MS + EXPLOSION_MS || e.kandidaten.length === 0) return 'explosion'
      return 'auswahl'
    }
    if (e.phase === 'landet') return 'storyline'
    return this.sim || this.gezogen ? 'frei' : null
  }

  private waechst(e: WolkenSchrittEingabe, stufe: WolkenStufe, seit: number): boolean {
    if (stufe === 'explosion') return seit < SAMMELN_MS + EXPLOSION_MS
    if (stufe === 'frei') return this.gezogen !== null || e.zeit - this.stufeSeit < LOSLASSEN_MS
    return e.zeit - this.stufeSeit < EINBLENDEN_MS[stufe] + (stufe === 'storyline' ? e.belege.length * BELEG_TAKT_MS : 0)
  }

  /** Neue Simulation an den aktuellen Lagen, mit dem Netz der gespeicherten Wolke. */
  private neu(e: WolkenSchrittEingabe, x: Float32Array, y: Float32Array): void {
    this.netzFuer = null
    this.knoten = Array.from({ length: e.px.length }, (_, i) => ({ i, x: x[i], y: y[i], vx: 0, vy: 0 }))
    this.altX = Float32Array.from(x)
    this.altY = Float32Array.from(y)
    this.sim?.stop()
    this.sim = forceSimulation<Knoten, Kante>(this.knoten).velocityDecay(0.4).stop()
    this.schluessel = ''
    this.stufeJetzt = null
    this.taktSeit = Number.NEGATIVE_INFINITY
  }

  private wechsle(e: WolkenSchrittEingabe, stufe: WolkenStufe, seit: number): void {
    const sim = this.sim
    if (!sim) return
    if (stufe === 'explosion') {
      explosionsStoss(this.knoten, 0.08 * Math.min(e.breite, e.hoehe))
    }
    this.kraefte(e, stufe, seit)
    // Energie halten, solange sich etwas formt — auch in der Storyline, sonst verpuffen ihre Kraefte.
    // Nur die Explosion setzt die Energie; sonst gleitet sie zum Ziel (ein Sprung hiesse: alle
    // Kraefte auf einmal mehrfach so stark — Owner 23.11.2026: „der Uebergang ist zu abrupt").
    const halten = { sammeln: 0.6, explosion: 0.25, auswahl: 0.2, storyline: 0.3, frei: 0.25 }[stufe]
    if (stufe === 'explosion') sim.alpha(1)
    sim.alphaTarget(halten).alphaDecay(stufe === 'sammeln' ? 0.06 : stufe === 'explosion' || stufe === 'frei' ? 0.012 : 0.03)
    if (stufe === 'storyline') { this.gemeldet = false; this.ruhigSeit = null; this.titel = 0 }
  }

  /** Kraefte der Stufe an die laufende Simulation haengen; neue Stufen blenden sie ein. */
  private kraefte(e: WolkenSchrittEingabe, stufe: WolkenStufe, seit: number): void {
    const sim = this.sim
    if (!sim) return
    const ein = EINBLENDEN_MS[stufe] > 0 ? weich((e.zeit - this.stufeSeit) / EINBLENDEN_MS[stufe]) : 1
    const kr = wolkenKraefte({
      stufe, breite: e.breite, hoehe: e.hoehe, zelle: e.zelle, px: e.px, py: e.py, radien: e.radien,
      nachbarn: e.nachbarn, kandidaten: e.kandidaten, belege: e.belege, ein, belegEin: stufe === 'storyline' ? this.belegEin : () => ein,
      anteil: stufe === 'frei'
        ? (this.gezogen ? 0.1 : weich((e.zeit - this.stufeSeit) / LOSLASSEN_MS)) // beim Ziehen locker: die Nachbarn kommen mit
        : Math.min(1, Math.max(0, (seit - SAMMELN_MS) / EXPLOSION_MS)),
    }, this.netz)
    const kanten: Kante[] = kr.kanten.map((k) => ({ source: k.a, target: k.b, abstand: k.abstand, staerke: k.staerke }))
    sim.force('netz', forceLink<Knoten, Kante>(kanten).id((k) => k.i).distance((l) => l.abstand).strength((l) => l.staerke))
    const ab = kr.abstand
    // Auch das Beiseiteschieben waechst mit: die Reichweite der aktiven Punkte blendet sich ein.
    const gross = 1 + 0.4 * ein
    sim.force('abstand', ab ? abstandsKraft<Knoten>({
      radius: (i) => e.radien[i] * (ab.aktiv.has(i) ? gross : 1), aktiv: ab.aktiv, reichweite: (i) => ab.reichweite(i) * ein, luft: 3,
    }) : null)
    // Ziele einmal je Rechenschritt bestimmen, nicht je Abfrage.
    const ziele = this.ziele = this.knoten.map((k) => kr.ziel(k.i))
    sim.force('x', forceX<Knoten>((k) => ziele[k.i].x).strength((k) => ziele[k.i].zugX))
    sim.force('y', forceY<Knoten>((k) => ziele[k.i].y).strength((k) => ziele[k.i].zugY))
  }

  /** Titel erst, wenn die Kette steht; danach `STORYLINE_MS` zum Lesen, dann gelandet. */
  private storyline(e: WolkenSchrittEingabe, stufe: WolkenStufe): void {
    if (stufe !== 'storyline') { this.titel = 0; return }
    // Die Kette steht, wenn jeder Beleg an seinem Platz auf der Achse angekommen ist.
    const fern = Math.max(0, ...e.belege.map((i) => Math.hypot((this.knoten[i].x ?? 0) - this.ziele[i].x, (this.knoten[i].y ?? 0) - this.ziele[i].y)))
    const staffel = Math.max(0, e.belege.length - 1) * BELEG_TAKT_MS
    const steht = (e.zeit - this.stufeSeit >= EINBLENDEN_MS.storyline + staffel && fern < AM_PLATZ) || e.zeit - this.stufeSeit > HOECHSTENS_MS + staffel
    if (steht && this.ruhigSeit === null) this.ruhigSeit = e.zeit
    this.titel = this.ruhigSeit === null ? 0 : Math.min(1, (e.zeit - this.ruhigSeit) / 600)
    if (this.ruhigSeit !== null && !this.gemeldet && e.zeit - this.ruhigSeit >= STORYLINE_MS) {
      this.gemeldet = true
      e.onGelandet()
    }
  }
}
