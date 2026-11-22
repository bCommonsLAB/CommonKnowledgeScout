'use client'

/**
 * Zeichenflaeche des Teppichs der Dokumente (Plan `teppich-der-dokumente`, T2).
 *
 * Eine Canvas-Flaeche hinter der Fragen-Sektion: jedes Dokument ein Punkt an seinem
 * Platz (`packeTeppich`), Groesse nach Gewicht, Jahreszahlen unten. In Ruhe schwebt
 * jeder Punkt leicht, eine langsame Welle laeuft durch; bei reduzierter Bewegung steht
 * alles. Gezeichnet wird nur, solange die Flaeche sichtbar ist.
 *
 * Ueberfahren zeigt Titel und Jahr; Klick auf einen Punkt meldet ihn (`onPunkt`),
 * Klick auf eine freie Stelle meldet `onFreieStelle`. Die Farbe kommt aus der
 * Schriftfarbe der Flaeche — hell auf dunklen Sektionen, dunkel auf hellen.
 */

import * as React from 'react'
import { naechsterTeppichPunkt, packeTeppich, teppichRadius, type TeppichPunkt } from '..'

export interface WebsiteTeppichProps {
  punkte: readonly TeppichPunkt[]
  /** Der Vordergrund ist ausgeblendet: Punkte deutlicher. */
  abgetaucht: boolean
  onPunkt: (punkt: TeppichPunkt) => void
  onFreieStelle: () => void
}

const RAND = 24
const ALPHA_RUHE = 0.32
const ALPHA_FREI = 0.6

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

export function WebsiteTeppich({ punkte, abgetaucht, onPunkt, onFreieStelle }: WebsiteTeppichProps): React.ReactElement {
  const huelle = React.useRef<HTMLDivElement>(null)
  const leinwand = React.useRef<HTMLCanvasElement>(null)
  const [groesse, setGroesse] = React.useState({ breite: 0, hoehe: 0 })
  const [sichtbar, setSichtbar] = React.useState(true)
  const [ueber, setUeber] = React.useState(-1)
  const bewegung = useBewegungErlaubt()

  React.useEffect(() => {
    const el = huelle.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setGroesse({ breite: Math.floor(e.contentRect.width), hoehe: Math.floor(e.contentRect.height) }))
    ro.observe(el)
    const io = new IntersectionObserver(([e]) => setSichtbar(e.isIntersecting))
    io.observe(el)
    return () => { ro.disconnect(); io.disconnect() }
  }, [])

  const raster = React.useMemo(() => packeTeppich(punkte, { ...groesse, rand: RAND }), [punkte, groesse])
  const radien = React.useMemo(() => Float32Array.from(punkte, (p) => teppichRadius(raster.zelle, p.gewicht)), [punkte, raster.zelle])

  React.useEffect(() => {
    const cv = leinwand.current
    const el = huelle.current
    if (!cv || !el || groesse.breite === 0) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.round(groesse.breite * dpr)
    cv.height = Math.round(groesse.hoehe * dpr)
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const farbe = getComputedStyle(el).color
    const { px, py, zelle, jahrMarken } = raster
    const a = Math.max(1.2, Math.min(4, zelle * 0.3))
    const b = Math.max(1.4, Math.min(6, zelle * 0.45))

    const zeichne = (zeit: number) => {
      const t = zeit / 1000
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, groesse.breite, groesse.hoehe)
      ctx.fillStyle = farbe
      ctx.globalAlpha = abgetaucht ? ALPHA_FREI : ALPHA_RUHE
      // Schweben je Punkt (eigene Phase aus dem Index) plus eine Welle ueber die Flaeche.
      const lageX = (i: number) => {
        const s = (i * 0.6180339) % 1
        return px[i] + (bewegung ? a * Math.sin(t * (0.5 + s * 0.5) + s * 6.283) + b * Math.sin(py[i] * 0.012 + t * 0.45) : 0)
      }
      const lageY = (i: number) => {
        const s = (i * 0.6180339) % 1
        return py[i] + (bewegung ? a * Math.cos(t * (0.45 + s * 0.5) + s * 9.42) + b * Math.cos(px[i] * 0.009 + t * 0.4) : 0)
      }
      ctx.beginPath()
      for (let i = 0; i < px.length; i++) {
        const x = lageX(i)
        const y = lageY(i)
        const r = radien[i]
        if (r < 1.1) ctx.rect(x - r, y - r, r * 2, r * 2)
        else { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832) }
      }
      ctx.fill()
      ctx.globalAlpha = 0.7
      ctx.font = '11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      for (const m of jahrMarken) ctx.fillText(String(m.jahr), m.x, groesse.hoehe - 6)
      if (ueber >= 0 && ueber < px.length) {
        ctx.globalAlpha = 1
        ctx.strokeStyle = farbe
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(lageX(ueber), lageY(ueber), radien[ueber] + 4, 0, 6.2832)
        ctx.stroke()
      }
    }

    if (!bewegung || !sichtbar) { zeichne(0); return }
    let bild = 0
    const schritt = (zeit: number) => {
      if (document.visibilityState === 'visible') zeichne(zeit)
      bild = requestAnimationFrame(schritt)
    }
    bild = requestAnimationFrame(schritt)
    return () => cancelAnimationFrame(bild)
  }, [raster, radien, groesse, abgetaucht, bewegung, sichtbar, ueber])

  const treffer = (e: React.PointerEvent | React.MouseEvent): number => {
    const rect = leinwand.current?.getBoundingClientRect()
    if (!rect) return -1
    return naechsterTeppichPunkt(raster.px, raster.py, e.clientX - rect.left, e.clientY - rect.top, Math.max(6, raster.zelle * 0.8))
  }
  const punkt = ueber >= 0 ? punkte[ueber] : undefined

  return (
    <div ref={huelle} className="absolute inset-0 text-current" data-website-teppich>
      <canvas
        ref={leinwand}
        className={punkt ? 'h-full w-full cursor-pointer' : 'h-full w-full'}
        aria-hidden="true"
        onPointerMove={(e) => { const i = treffer(e); if (i !== ueber) setUeber(i) }}
        onPointerLeave={() => setUeber(-1)}
        onClick={(e) => { const i = treffer(e); if (i >= 0) onPunkt(punkte[i]); else onFreieStelle() }}
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
