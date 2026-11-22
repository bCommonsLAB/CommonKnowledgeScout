'use client'

/**
 * Zeichenflaechen des Teppichs der Dokumente (Plan `teppich-der-dokumente`, T2/T3).
 *
 * `WebsiteTeppich` ist die hintere Leinwand hinter der Fragen-Sektion: jedes Dokument ein
 * Punkt an seinem Platz (`packeTeppich`), Groesse nach Gewicht, Jahreszahlen unten. In Ruhe
 * schwebt jeder Punkt leicht; beim Fragen schwaermen alle. Steht die Antwort, liegt jeder Beleg
 * unter der Nummernmarke seiner Karte, das Raster verzieht sich mit (`TeppichSzene`). Die Karte
 * der Sektion ist dafuer leicht durchscheinend. Die Schleife laeuft nur, solange die Flaeche
 * sichtbar ist.
 *
 * In Ruhe und bei stehender Antwort: Ueberfahren zeigt Titel und Jahr, Klick auf einen Punkt
 * meldet ihn (`onPunkt`), Klick auf eine freie Stelle `onFreieStelle`. Waehrend der Suche und
 * des Flugs nimmt die Leinwand keine Klicks an, der Schwarm folgt dem Zeiger.
 */

import * as React from 'react'
import { naechsterTeppichPunkt, packeTeppich, teppichRadius, type TeppichPhase, type TeppichPunkt } from '..'
import { TeppichSzene } from './teppich-szene'

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
  /** Der Flug der Belege ist fertig. */
  onGelandet?: () => void
  /** Gemeinsame Szene mit der vorderen Leinwand; ohne Angabe eine eigene. */
  szene?: TeppichSzene
}

const RAND = 24
const KEINE_BELEGE: readonly string[] = []

/**
 * Hoehe des sichtbaren Bereichs: der naechste scrollende Behaelter (Site-Modus der App), sonst
 * das Fenster. Der Teppich ist hoechstens so hoch und bleibt beim Scrollen stehen (sticky) —
 * er ist immer ganz im Bild, nicht nur ein Ausschnitt der Sektion (Owner 22.11.2026).
 */
function sichtHoehe(el: HTMLElement): number {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p.clientHeight
  }
  return window.innerHeight
}

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
  const { punkte, abgetaucht, onPunkt, onFreieStelle, phase = 'ruhe', belege = KEINE_BELEGE, onGelandet } = p
  const eigene = React.useMemo(() => new TeppichSzene(), [])
  const szene = p.szene ?? eigene
  const huelle = React.useRef<HTMLDivElement>(null)
  const [groesse, setGroesse] = React.useState({ breite: 0, hoehe: 0 })
  const [sichtbar, setSichtbar] = React.useState(true)
  const [ueber, setUeber] = React.useState(-1)
  const bewegung = useBewegungErlaubt()
  const ruhig = phase === 'ruhe' || phase === 'antwort'

  React.useEffect(() => {
    const el = huelle.current
    const flaeche = el?.parentElement
    if (!el || !flaeche) return
    // Breite und Hoehe der Sektion; der Teppich nimmt davon hoechstens die sichtbare Hoehe.
    const miss = () => {
      const r = flaeche.getBoundingClientRect()
      const breite = Math.floor(r.width)
      const hoehe = Math.floor(Math.min(r.height, sichtHoehe(flaeche)))
      // Nur bei echter Aenderung: ein neues Objekt hiesse ein neues Raster.
      setGroesse((g) => (g.breite === breite && g.hoehe === hoehe ? g : { breite, hoehe }))
    }
    const ro = new ResizeObserver(miss)
    ro.observe(flaeche)
    window.addEventListener('resize', miss)
    const io = new IntersectionObserver(([e]) => setSichtbar(e.isIntersecting))
    io.observe(el)
    return () => { ro.disconnect(); io.disconnect(); window.removeEventListener('resize', miss) }
  }, [])

  const raster = React.useMemo(() => packeTeppich(punkte, { ...groesse, rand: RAND }), [punkte, groesse])
  const radien = React.useMemo(() => Float32Array.from(punkte, (q) => teppichRadius(raster.zelle, q.gewicht)), [punkte, raster.zelle])
  const gelandet = React.useRef(onGelandet)
  gelandet.current = onGelandet

  // Jeder Render reicht den neuen Stand an die Szene; die Schleife liest ihn im naechsten Bild.
  React.useEffect(() => {
    szene.setze({
      punkte, raster, radien, phase, belege, abgetaucht, bewegung, ueber: ruhig ? ueber : -1,
      breite: groesse.breite, hoehe: groesse.hoehe,
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
      const r = huelle.current?.getBoundingClientRect()
      if (r) szene.zeiger = { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    window.addEventListener('pointermove', bewegt)
    return () => window.removeEventListener('pointermove', bewegt)
  }, [phase, szene])

  const leinwand = React.useCallback((el: HTMLCanvasElement | null) => { szene.hinten = el }, [szene])
  const treffer = (e: React.PointerEvent | React.MouseEvent): number => {
    const rect = huelle.current?.getBoundingClientRect()
    if (!rect || !ruhig) return -1
    return naechsterTeppichPunkt(raster.px, raster.py, e.clientX - rect.left, e.clientY - rect.top, Math.max(6, raster.zelle * 0.8))
  }
  const punkt = ruhig && ueber >= 0 ? punkte[ueber] : undefined

  return (
    <div ref={huelle} className="sticky top-0 w-full text-current" style={{ height: groesse.hoehe || undefined }} data-website-teppich data-teppich-phase={phase}>
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
          style={{ left: Math.min(groesse.breite - 248, raster.px[ueber] + 12), top: Math.max(4, raster.py[ueber] - 44) }}
          data-teppich-tooltip
        >
          <span className="block font-medium">{punkt.titel}</span>
          {punkt.jahr !== null && <span className="text-neutral-500">{punkt.jahr}</span>}
        </div>
      )}
    </div>
  )
}
