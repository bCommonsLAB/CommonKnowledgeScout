'use client'

/**
 * Zeichenflaechen des Teppichs der Dokumente (Plan `teppich-der-dokumente`, T2/T3).
 *
 * `WebsiteTeppich` ist die Leinwand hinter der Fragen-Sektion: jedes Dokument ein Punkt an seinem
 * Platz in der Wolke (`packeWolke`, T5b), Groesse nach Gewicht. Die Wolke liegt in einem Kasten so
 * breit wie die Antwort, hinter der Zone der Antwort, und scrollt mit der Seite (`useTeppichHalt`).
 * Die Leinwand ist so breit wie die Sektion, der Schwarm darf ueber den Kasten hinaus fliegen. Mit
 * der Antwort fliegen alle Punkte zurueck (`TeppichSzene`). Die Schleife laeuft nur bei Sicht.
 *
 * In Ruhe und bei stehender Antwort: Ueberfahren zeigt Titel und Jahr, Klick auf einen Punkt
 * meldet ihn (`onPunkt`), Klick auf eine freie Stelle `onFreieStelle`. Waehrend der Suche und
 * des Flugs nimmt die Leinwand keine Klicks an, der Schwarm folgt dem Zeiger.
 *
 * Graph-Ansicht (`abgetaucht`, Owner 24.11.2026): Die Ebene liegt als eigene Seite ueber dem
 * Bildschirm (der Rahmen der Sektion legt sie fest), die Wolke fuellt sie. Mausrad und zwei Finger
 * zoomen, Ziehen verschiebt (`useTeppichSicht`). Ein Tipp auf einen Punkt WAEHLT ihn — Karte mit
 * Titel und dem Weg zum Dokument —, ein Tipp ins Leere waehlt ab. Zu geht es nur ueber den
 * Schliessen-Knopf oder Escape, nie ueber den Hintergrund.
 */

import * as React from 'react'
import { naechsterTeppichPunkt, packeWolke, teppichRadius, type TeppichAnimation, type TeppichPhase, type TeppichPunkt } from '..'
import { TeppichSzene } from './teppich-szene'
import { useTeppichFlaeche } from './use-teppich-flaeche'
import { useTeppichHalt } from './use-teppich-halt'
import { useTeppichZeiger } from './use-teppich-zeiger'
import type { TeppichBotschaft } from './use-teppich-botschaft'
import { useZurFrageScrollen } from './use-zur-frage-scrollen'
import { useSchmal } from './use-schmal'
import { useBewegungErlaubt, useGraphHoehe } from './use-teppich-masse'
import { useTeppichSicht } from './use-teppich-sicht'
import { TeppichGraphKarte, TeppichGraphKopf } from './website-teppich-graph'
import { TeppichBotschaftBlatt } from './website-teppich-botschaft'

export interface WebsiteTeppichProps {
  punkte: readonly TeppichPunkt[]
  /** Der Vordergrund ist ausgeblendet: Punkte deutlicher. */
  abgetaucht: boolean
  onPunkt: (punkt: TeppichPunkt) => void
  /** `touch`: mit dem Finger getippt (ein Tipp ins Leere oeffnet die Graph-Ansicht nicht). */
  onFreieStelle: (touch: boolean) => void
  /** Graph-Ansicht schliessen (Knopf in ihrer Kopfzeile). */
  onZu?: () => void
  /** Phase der Frage (T3); ohne Angabe Ruhe. */
  phase?: TeppichPhase
  /** Belege der stehenden Antwort, in der Reihenfolge ihrer Nummern (fileIds). */
  belege?: readonly string[]
  /** T4: Kandidaten der Suche (fileIds), sobald die Suche sie meldet. */
  kandidaten?: readonly string[]
  /** Der Flug der Belege ist fertig. */
  onGelandet?: () => void
  /** Gemeinsame Szene; ohne Angabe eine eigene. */
  szene?: TeppichSzene
  /** Animation (Parameter `animation=` der Sektion); ohne Angabe `schwarm`. */
  animation?: TeppichAnimation
  /** Waehrend einer Frage: Titel und Schritte, oben links ueber der Wolke (unter dem Frage-Block). */
  botschaft?: TeppichBotschaft
}

const RAND = 12
/** Rand der Wolke in der Graph-Ansicht und Trefferweite fuer den Finger (Pixel am Bildschirm). */
const [GRAPH_RAND, FINGER] = [28, 22]
const KEINE_BELEGE: readonly string[] = []

export function WebsiteTeppich(p: WebsiteTeppichProps): React.ReactElement {
  const { punkte, abgetaucht, onPunkt, onFreieStelle, phase = 'ruhe', belege = KEINE_BELEGE, kandidaten = KEINE_BELEGE, onGelandet } = p
  const eigene = React.useMemo(() => new TeppichSzene(), [])
  const szene = p.szene ?? eigene
  const huelle = React.useRef<HTMLDivElement>(null)
  const flaeche = React.useRef<HTMLDivElement>(null)
  const { breite, kasten, sichtbar } = useTeppichFlaeche(huelle)
  // Der Punkt unter dem Zeiger (`useTeppichZeiger`, weiter unten); die Szene liest ihn je Render.
  const ueberRef = React.useRef(-1)
  const bewegung = useBewegungErlaubt()
  const schmal = useSchmal()
  const ruhig = phase === 'ruhe' || phase === 'antwort'
  useZurFrageScrollen(huelle, phase, bewegung)
  const halt = useTeppichHalt(huelle, phase, kasten.hoehe)
  const vollHoehe = useGraphHoehe(flaeche, abgetaucht, breite)
  const graph = abgetaucht && vollHoehe > 0
  const hoehe = graph ? vollHoehe : kasten.hoehe
  const [gewaehlt, setGewaehlt] = React.useState(-1)
  React.useEffect(() => { if (!abgetaucht) setGewaehlt(-1) }, [abgetaucht])

  const plaetze = React.useMemo(
    () => (graph
      ? packeWolke(punkte, { breite, hoehe: vollHoehe, rand: GRAPH_RAND })
      : packeWolke(punkte, { breite: kasten.breite, hoehe: kasten.hoehe, rand: RAND, versatz: kasten.links })),
    [punkte, kasten, graph, breite, vollHoehe],
  )
  const radien = React.useMemo(() => Float32Array.from(punkte, (q) => teppichRadius(plaetze.zelle, q.gewicht)), [punkte, plaetze.zelle])
  const gelandet = React.useRef(onGelandet); gelandet.current = onGelandet

  // Jeder Render reicht den neuen Stand an die Szene; die Schleife liest ihn im naechsten Bild.
  React.useEffect(() => {
    szene.setze({
      punkte, plaetze, radien, phase, belege, kandidaten, abgetaucht, animation: p.animation ?? 'schwarm', bewegung, ueber: ruhig ? ueberRef.current : -1,
      breite, hoehe, kasten: graph ? { breite, hoehe, links: 0 } : kasten,
      farbe: huelle.current ? getComputedStyle(huelle.current).color : 'currentColor',
      onGelandet: () => gelandet.current?.(),
    })
  })

  React.useEffect(() => {
    if (!sichtbar) return
    let bild = 0
    let vorher = 0
    const schritt = (zeit: number) => {
      const dt = vorher ? Math.min(0.05, (zeit - vorher) / 1000) : 0
      vorher = zeit
      if (document.visibilityState === 'visible') szene.bild(zeit, dt)
      bild = requestAnimationFrame(schritt)
    }
    bild = requestAnimationFrame(schritt)
    return () => cancelAnimationFrame(bild)
  }, [szene, sichtbar])

  // Ohne Bilder kein Flug: Liegt die Flaeche ausser Sicht oder der Reiter im Hintergrund,
  // landen die Belege sofort — sonst bliebe die Antwort unsichtbar, bis man wieder hinsieht.
  React.useEffect(() => {
    if (phase !== 'landet') return
    const pruefe = () => { if (!sichtbar || document.visibilityState !== 'visible') gelandet.current?.() }
    pruefe()
    document.addEventListener('visibilitychange', pruefe)
    return () => document.removeEventListener('visibilitychange', pruefe)
  }, [phase, sichtbar])

  // Waehrend der Suche folgt der Schwarm dem Zeiger, auch ueber der (ausgeblendeten) Karte.
  React.useEffect(() => {
    if (phase !== 'sucht') { szene.zeiger = null; return }
    const bewegt = (e: PointerEvent) => {
      const r = flaeche.current?.getBoundingClientRect()
      if (r) szene.zeiger = { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    window.addEventListener('pointermove', bewegt)
    return () => window.removeEventListener('pointermove', bewegt)
  }, [phase, szene])

  const leinwand = React.useCallback((el: HTMLCanvasElement | null) => { szene.hinten = el }, [szene])
  const sichtRef = React.useRef<{ zuWelt: (x: number, y: number) => [number, number] } | null>(null)
  const treffer = (e: React.PointerEvent | React.MouseEvent): number => {
    if (!ruhig || !sichtRef.current) return -1
    const [wx, wy] = sichtRef.current.zuWelt(e.clientX, e.clientY)
    // Die Punkte liegen, wo die Szene sie zeichnet (in der Wolke nicht immer am festen Platz).
    const { x, y } = szene.lage.x.length === punkte.length ? szene.lage : { x: plaetze.px, y: plaetze.py }
    // Mit dem Finger trifft man grosszuegiger; die Weite gilt am Bildschirm, nicht in der gezoomten Wolke.
    const finger = 'pointerType' in e.nativeEvent && e.nativeEvent.pointerType === 'touch'
    return naechsterTeppichPunkt(x, y, wx, wy, Math.max(6, plaetze.zelle * 0.8, (finger ? FINGER : 0) / szene.sicht.z))
  }
  const sicht = useTeppichSicht({ szene, flaeche, aktiv: graph, aufPunkt: (e) => treffer(e) >= 0 })
  sichtRef.current = sicht
  const zeiger = useTeppichZeiger({
    szene, ruhig, treffer, zuWelt: sicht.zuWelt,
    // Graph-Ansicht: ein Tipp waehlt den Punkt, das Dokument oeffnet erst der Knopf der Karte.
    onPunkt: (i) => (abgetaucht ? setGewaehlt(i) : onPunkt(punkte[i])),
    onFreieStelle: (touch) => (abgetaucht ? setGewaehlt(-1) : onFreieStelle(touch)),
  })
  const z = zeiger.leinwand
  const ereignisse: React.CanvasHTMLAttributes<HTMLCanvasElement> = {
    ...z, onPointerDown: (e) => { if (!sicht.unten(e)) z.onPointerDown?.(e) },
    onPointerMove: (e) => { if (!sicht.bewegt(e)) z.onPointerMove?.(e) },
    onPointerUp: (e) => { if (!sicht.oben(e)) z.onPointerUp?.(e) },
    onPointerCancel: (e) => { sicht.oben(e) },
    // Das Loslassen nach Verschieben oder Zoomen ist kein Tipp.
    onClick: (e) => { if (!sicht.warGeste()) z.onClick?.(e) },
  }
  const ueber = abgetaucht && gewaehlt >= 0 ? gewaehlt : zeiger.ueber
  ueberRef.current = ueber
  const punkt = ruhig && ueber >= 0 ? punkte[ueber] : undefined
  const ort = (i: number): [number, number] => {
    const s = szene.sicht
    return [(szene.lage.x[i] ?? plaetze.px[i]) * s.z + s.x, (szene.lage.y[i] ?? plaetze.py[i]) * s.z + s.y]
  }

  return (
    <div ref={huelle} className={abgetaucht ? 'flex h-full w-full flex-col text-current' : 'w-full text-current'} style={abgetaucht ? undefined : halt} data-website-teppich data-teppich-phase={phase} data-teppich-graph={abgetaucht || undefined}>
      {abgetaucht && p.onZu && <TeppichGraphKopf onZu={p.onZu} onZoom={sicht.zoom} />}
      <div ref={flaeche} className={abgetaucht ? 'relative min-h-0 w-full flex-1 touch-none overflow-hidden' : 'relative w-full'} style={abgetaucht ? undefined : { height: kasten.hoehe || undefined }}>
        <canvas ref={leinwand} className={abgetaucht ? 'h-full w-full cursor-grab touch-none' : punkt ? 'h-full w-full cursor-grab touch-none' : 'h-full w-full'} aria-hidden="true" {...ereignisse} />
        {punkt && !(abgetaucht && gewaehlt >= 0) && (
          <div
            className="pointer-events-none absolute z-20 max-w-60 rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 shadow-md"
            style={{ left: Math.max(4, Math.min(breite - 248, ort(ueber)[0] + 12)), top: Math.max(4, ort(ueber)[1] - 44) }}
            data-teppich-tooltip
          >
            <span className="block font-medium">{punkt.titel}</span>
            {punkt.jahr !== null && <span className="text-neutral-500">{punkt.jahr}</span>}
          </div>
        )}
        {abgetaucht && gewaehlt >= 0 && punkte[gewaehlt] && (
          <TeppichGraphKarte punkt={punkte[gewaehlt]} onOeffnen={() => onPunkt(punkte[gewaehlt])} onZu={() => setGewaehlt(-1)} />
        )}
        {/* Oben buendig (Owner 23.11.2026), auf dem Telefon als Statusblatt am unteren Rand (R3). */}
        {p.botschaft && <TeppichBotschaftBlatt botschaft={p.botschaft} schmal={schmal} links={kasten.links + 84} />}
      </div>
    </div>
  )
}
