'use client'

/**
 * Zeichenflaechen des Teppichs der Dokumente (Plan `teppich-der-dokumente`, T2/T3).
 *
 * `WebsiteTeppich` ist die Leinwand hinter der Fragen-Sektion: jedes Dokument ein Punkt an
 * seinem Platz in der Wolke (`packeWolke`, T5b), Groesse nach Gewicht. Owner 23.11.2026:
 * Die Wolke liegt in einem Kasten so breit wie die Antwort, 16:9, nie hoeher als der sichtbare
 * Bereich; darunter die Botschaft. Sie liegt hinter der Zone der Antwort und scrollt mit der Seite
 * (`useTeppichHalt`); die Frage steht als Frage-Block der Konversation darueber. Die Leinwand ist so breit wie die Sektion, der Schwarm darf ueber den
 * Kasten hinaus fliegen. Mit der Antwort fliegen alle Punkte an ihren Platz zurueck
 * (`TeppichSzene`). Die Schleife laeuft nur, solange die Flaeche sichtbar ist.
 *
 * In Ruhe und bei stehender Antwort: Ueberfahren zeigt Titel und Jahr, Klick auf einen Punkt
 * meldet ihn (`onPunkt`), Klick auf eine freie Stelle `onFreieStelle`. Waehrend der Suche und
 * des Flugs nimmt die Leinwand keine Klicks an, der Schwarm folgt dem Zeiger.
 */

import * as React from 'react'
import { naechsterTeppichPunkt, packeWolke, teppichRadius, type TeppichAnimation, type TeppichPhase, type TeppichPunkt } from '..'
import { TeppichSzene } from './teppich-szene'
import { useTeppichFlaeche } from './use-teppich-flaeche'
import { useTeppichHalt } from './use-teppich-halt'
import { useTeppichZeiger } from './use-teppich-zeiger'
import type { TeppichBotschaft } from './use-teppich-botschaft'
import { useZurFrageScrollen } from './use-zur-frage-scrollen'

export interface WebsiteTeppichProps {
  punkte: readonly TeppichPunkt[]
  /** Der Vordergrund ist ausgeblendet: Punkte deutlicher. */
  abgetaucht: boolean
  onPunkt: (punkt: TeppichPunkt) => void
  onFreieStelle: () => void
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
/** Neue Zeilen der Botschaft gleiten weich herein. */
const EIN = '@keyframes ks-teppich-ein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'
const KEINE_BELEGE: readonly string[] = []

function useBewegungErlaubt(): boolean {
  const [erlaubt, setErlaubt] = React.useState(true)
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const lies = () => setErlaubt(!mq.matches)
    lies()
    mq.addEventListener('change', lies)
    return () => mq.removeEventListener('change', lies)
  }, [])
  return erlaubt
}

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
  const ruhig = phase === 'ruhe' || phase === 'antwort'
  useZurFrageScrollen(huelle, phase, bewegung)
  const halt = useTeppichHalt(huelle, phase, kasten.hoehe)

  const plaetze = React.useMemo(
    () => packeWolke(punkte, { breite: kasten.breite, hoehe: kasten.hoehe, rand: RAND, versatz: kasten.links }),
    [punkte, kasten],
  )
  const radien = React.useMemo(() => Float32Array.from(punkte, (q) => teppichRadius(plaetze.zelle, q.gewicht)), [punkte, plaetze.zelle])
  const gelandet = React.useRef(onGelandet)
  gelandet.current = onGelandet

  // Jeder Render reicht den neuen Stand an die Szene; die Schleife liest ihn im naechsten Bild.
  React.useEffect(() => {
    szene.setze({
      punkte, plaetze, radien, phase, belege, kandidaten, abgetaucht, animation: p.animation ?? 'schwarm', bewegung, ueber: ruhig ? ueberRef.current : -1,
      breite, hoehe: kasten.hoehe, kasten,
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
  const treffer = (e: React.PointerEvent | React.MouseEvent): number => {
    const rect = flaeche.current?.getBoundingClientRect()
    if (!rect || !ruhig) return -1
    // Die Punkte liegen, wo die Szene sie zeichnet (in der Wolke nicht immer am festen Platz).
    const { x, y } = szene.lage.x.length === punkte.length ? szene.lage : { x: plaetze.px, y: plaetze.py }
    return naechsterTeppichPunkt(x, y, e.clientX - rect.left, e.clientY - rect.top, Math.max(6, plaetze.zelle * 0.8))
  }
  const zeiger = useTeppichZeiger({ szene, flaeche, ruhig, treffer, onPunkt: (i) => onPunkt(punkte[i]), onFreieStelle })
  const ueber = zeiger.ueber
  ueberRef.current = ueber
  const punkt = ruhig && ueber >= 0 ? punkte[ueber] : undefined

  return (
    <div ref={huelle} className="w-full text-current" style={halt} data-website-teppich data-teppich-phase={phase}>
      <div ref={flaeche} className="relative w-full" style={{ height: kasten.hoehe || undefined }}>
        <canvas ref={leinwand} className={punkt ? 'h-full w-full cursor-grab touch-none' : 'h-full w-full'} aria-hidden="true" {...zeiger.leinwand} />
        {punkt && (
          <div
            className="pointer-events-none absolute z-20 max-w-60 rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 shadow-md"
            style={{ left: Math.min(breite - 248, (szene.lage.x[ueber] ?? plaetze.px[ueber]) + 12), top: Math.max(4, (szene.lage.y[ueber] ?? plaetze.py[ueber]) - 44) }}
            data-teppich-tooltip
          >
            <span className="block font-medium">{punkt.titel}</span>
            {punkt.jahr !== null && <span className="text-neutral-500">{punkt.jahr}</span>}
          </div>
        )}
        {p.botschaft && (
          // Oben buendig (Owner 23.11.2026): Titel, darunter waechst die Liste der Schritte nach unten.
          <div className="pointer-events-none absolute top-24 max-w-xs" style={{ left: kasten.links + 84 }} aria-live="polite" data-teppich-botschaft>
            <style>{EIN}</style>
            <p className="text-sm font-semibold">{p.botschaft.titel}</p>
            <ol className="mt-2 space-y-1 text-sm">
              {p.botschaft.schritte.map((schritt, k, alle) => (
                <li key={k} className={k === alle.length - 1 ? 'transition-opacity duration-500' : 'opacity-50 transition-opacity duration-500'} style={{ animation: 'ks-teppich-ein 600ms ease backwards' }}>
                  {schritt}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
