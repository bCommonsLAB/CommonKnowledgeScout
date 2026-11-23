'use client'

/**
 * Zeichenflaechen des Teppichs der Dokumente (Plan `teppich-der-dokumente`, T2/T3).
 *
 * `WebsiteTeppich` ist die Leinwand hinter der Fragen-Sektion: jedes Dokument ein Punkt an
 * seinem Platz in der Wolke (`packeWolke`, T5b), Groesse nach Gewicht. Owner 23.11.2026:
 * Die Wolke liegt in einem Kasten so breit wie die Antwort, 16:9, nie hoeher als der sichtbare
 * Bereich; darueber die Frage, darunter die Botschaft, alles zusammen klebt oben (sticky) und
 * bleibt ganz im Bild. Die Leinwand ist so breit wie die Sektion, der Schwarm darf ueber den
 * Kasten hinaus fliegen. Mit der Antwort fliegen alle Punkte an ihren Platz zurueck
 * (`TeppichSzene`). Die Schleife laeuft nur, solange die Flaeche sichtbar ist.
 *
 * In Ruhe und bei stehender Antwort: Ueberfahren zeigt Titel und Jahr, Klick auf einen Punkt
 * meldet ihn (`onPunkt`), Klick auf eine freie Stelle `onFreieStelle`. Waehrend der Suche und
 * des Flugs nimmt die Leinwand keine Klicks an, der Schwarm folgt dem Zeiger.
 */

import * as React from 'react'
import { TEPPICH_OBEN, TEPPICH_UNTEN, naechsterTeppichPunkt, packeWolke, teppichRadius, type TeppichAnimation, type TeppichPhase, type TeppichPunkt } from '..'
import { TeppichSzene } from './teppich-szene'
import { useTeppichFlaeche } from './use-teppich-flaeche'
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
  /** Waehrend einer Frage: die Frage ueber dem Kasten. */
  frage?: string
  /** Waehrend einer Frage: was die Animation gerade zeigt, in Worten (unter dem Kasten). */
  botschaft?: string
}

const RAND = 12
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
  const [ueber, setUeber] = React.useState(-1)
  const bewegung = useBewegungErlaubt()
  const ruhig = phase === 'ruhe' || phase === 'antwort'
  useZurFrageScrollen(huelle, phase, bewegung)

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
      punkte, plaetze, radien, phase, belege, kandidaten, abgetaucht, animation: p.animation ?? 'schwarm', bewegung, ueber: ruhig ? ueber : -1,
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
    return naechsterTeppichPunkt(plaetze.px, plaetze.py, e.clientX - rect.left, e.clientY - rect.top, Math.max(6, plaetze.zelle * 0.8))
  }
  const punkt = ruhig && ueber >= 0 ? punkte[ueber] : undefined

  return (
    <div ref={huelle} className="sticky top-0 w-full text-current" data-website-teppich data-teppich-phase={phase}>
      <div className="flex items-end justify-center px-6 pb-3" style={{ height: TEPPICH_OBEN }}>
        {p.frage && (
          <p className="pointer-events-none line-clamp-2 max-w-3xl text-balance text-center text-xl font-semibold leading-snug" data-teppich-frage>
            {p.frage}
          </p>
        )}
      </div>
      <div ref={flaeche} className="relative w-full" style={{ height: kasten.hoehe || undefined }}>
        <canvas
          ref={leinwand}
          className={punkt ? 'h-full w-full cursor-pointer' : 'h-full w-full'}
          aria-hidden="true"
          onPointerMove={(e) => { const i = treffer(e); if (i !== ueber) setUeber(i) }}
          onPointerLeave={() => setUeber(-1)}
          onClick={(e) => {
            if (!ruhig) return
            const i = treffer(e)
            if (i >= 0) onPunkt(punkte[i])
            else onFreieStelle()
          }}
        />
        {punkt && (
          <div
            className="pointer-events-none absolute z-20 max-w-60 rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-xs text-neutral-900 shadow-md"
            style={{ left: Math.min(breite - 248, plaetze.px[ueber] + 12), top: Math.max(4, plaetze.py[ueber] - 44) }}
            data-teppich-tooltip
          >
            <span className="block font-medium">{punkt.titel}</span>
            {punkt.jahr !== null && <span className="text-neutral-500">{punkt.jahr}</span>}
          </div>
        )}
      </div>
      <div className="flex items-start justify-center px-6 pt-3" style={{ height: TEPPICH_UNTEN }}>
        {p.botschaft && (
          <p className="pointer-events-none max-w-2xl text-balance text-center text-base font-medium" aria-live="polite" data-teppich-botschaft>
            {p.botschaft}
          </p>
        )}
      </div>
    </div>
  )
}
