'use client'

/**
 * Zeiger auf dem Teppich der Dokumente (Plan `teppich-der-dokumente`, Owner 23.11.2026: „mit der
 * Maus die Elemente ueberfliegen und ziehen und so aehnliche finden").
 *
 * - Ueberfahren: der Punkt unter dem Zeiger (`ueber`), die Szene zeigt Ring und Linien zu den Nachbarn.
 * - Ziehen: Punkt halten und bewegen — er folgt dem Zeiger, das Netz zieht die aehnlichen Dokumente
 *   mit (wie in der Graph-Ansicht). Loslassen gibt ihn frei, die Wolke findet zurueck.
 * - Klick ohne Ziehen: auf einen Punkt `onPunkt`, auf eine freie Stelle `onFreieStelle`.
 */

import * as React from 'react'
import type { TeppichSzene } from './teppich-szene'

/** Ab dieser Strecke (Pixel) gilt ein gehaltener Zeiger als Ziehen, nicht als Klick. */
const ZIEH_SCHWELLE = 4

interface Zug { i: number; x0: number; y0: number; bewegt: boolean }
type Ereignis = React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>

export interface TeppichZeigerEingabe {
  szene: TeppichSzene
  /** Bildschirmpunkt → Ort in der Wolke (die Graph-Ansicht zoomt und verschiebt). */
  zuWelt: (clientX: number, clientY: number) => [number, number]
  /** Nur in Ruhe und bei stehender Antwort nimmt die Leinwand den Zeiger an. */
  ruhig: boolean
  /** Index des Punkts unter dem Zeiger, sonst -1. */
  treffer: (e: Ereignis) => number
  onPunkt: (i: number) => void
  /** `touch`: mit dem Finger getippt. */
  onFreieStelle: (touch: boolean) => void
}

export function useTeppichZeiger(o: TeppichZeigerEingabe): { ueber: number; leinwand: React.CanvasHTMLAttributes<HTMLCanvasElement> } {
  const [ueber, setUeber] = React.useState(-1)
  const zug = React.useRef<Zug | null>(null)
  const gezogen = React.useRef(false)
  return {
    ueber,
    leinwand: {
      onPointerDown: (e) => {
        const i = o.treffer(e)
        if (i < 0) return
        zug.current = { i, x0: e.clientX, y0: e.clientY, bewegt: false }
        e.currentTarget.setPointerCapture(e.pointerId)
        setUeber(i)
      },
      onPointerMove: (e) => {
        const z = zug.current
        if (!z) { const i = o.treffer(e); if (i !== ueber) setUeber(i); return }
        if (!z.bewegt && Math.hypot(e.clientX - z.x0, e.clientY - z.y0) < ZIEH_SCHWELLE) return
        z.bewegt = true
        const [wx, wy] = o.zuWelt(e.clientX, e.clientY)
        o.szene.zieh(z.i, wx, wy)
      },
      onPointerUp: (e) => {
        const z = zug.current
        zug.current = null
        if (!z) return
        e.currentTarget.releasePointerCapture(e.pointerId)
        o.szene.lasse()
        gezogen.current = z.bewegt
      },
      onPointerLeave: () => { if (!zug.current) setUeber(-1) },
      onClick: (e) => {
        // Das Loslassen nach dem Ziehen ist kein Klick.
        if (gezogen.current) { gezogen.current = false; return }
        if (!o.ruhig) return
        const i = o.treffer(e)
        if (i >= 0) o.onPunkt(i)
        else o.onFreieStelle('pointerType' in e.nativeEvent && e.nativeEvent.pointerType === 'touch')
      },
    },
  }
}
