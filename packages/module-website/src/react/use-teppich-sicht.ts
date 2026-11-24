'use client'

/**
 * Sicht auf den Graphen (Owner 24.11.2026: „mit den Fingern oder mit der Maus reinzoomen, dem
 * Mausrad"): Vergroesserung und Ausschnitt der Punktwolke in der Graph-Ansicht.
 *
 * - Mausrad: zoomt um den Zeiger.
 * - Zwei Finger: zoomen um ihre Mitte und verschieben.
 * - Ziehen auf einer freien Stelle (Maus oder ein Finger): verschiebt den Ausschnitt.
 *
 * Die Sicht liegt an der Szene (`szene.sicht`) — sie aendert sich je Zeigerereignis, nicht je
 * Render. Ausserhalb der Graph-Ansicht ist sie die Einheit (1, 0, 0).
 */

import * as React from 'react'
import type { TeppichSzene } from './teppich-szene'

const MIN = 1
const MAX = 12
/** Ab dieser Strecke (Pixel) gilt ein gehaltener Zeiger als Verschieben, nicht als Tipp. */
const SCHWELLE = 5

type Ereignis = React.PointerEvent<HTMLCanvasElement>

export interface TeppichSichtEingabe {
  szene: TeppichSzene
  flaeche: React.RefObject<HTMLDivElement | null>
  /** Nur in der Graph-Ansicht. */
  aktiv: boolean
  /** Liegt unter dem Zeiger ein Punkt? Dann gehoert das Ziehen dem Punkt, nicht dem Ausschnitt. */
  aufPunkt: (e: Ereignis) => boolean
}

export interface TeppichSicht {
  /** Bildschirmpunkt → Ort in der Wolke (Pixel der ungezoomten Leinwand). */
  zuWelt: (clientX: number, clientY: number) => [number, number]
  /** Jeweils `true`, wenn die Sicht das Ereignis verbraucht hat. */
  unten: (e: Ereignis) => boolean
  bewegt: (e: Ereignis) => boolean
  oben: (e: Ereignis) => boolean
  /** War das letzte Loslassen das Ende einer Geste? Dann ist der folgende Klick keiner. Liest und loescht. */
  warGeste: () => boolean
  /** Schrittweise zoomen (Knoepfe), um die Mitte der Flaeche. */
  zoom: (faktor: number) => void
}

export function useTeppichSicht(o: TeppichSichtEingabe): TeppichSicht {
  const { szene, flaeche, aktiv } = o
  const zeiger = React.useRef(new Map<number, { x: number; y: number }>())
  const zug = React.useRef<{ x: number; y: number; weit: boolean } | null>(null)
  const kniff = React.useRef<{ abstand: number; mx: number; my: number } | null>(null)
  const geste = React.useRef(false)

  /** Zoomt um den Punkt (`cx`, `cy`) der Flaeche und haelt die Wolke im Bild. */
  const zoomUm = React.useCallback((cx: number, cy: number, faktor: number, dx = 0, dy = 0) => {
    const r = flaeche.current?.getBoundingClientRect()
    if (!r) return
    const s = szene.sicht
    const z = Math.min(MAX, Math.max(MIN, s.z * faktor))
    const f = z / s.z
    const x = cx - (cx - s.x) * f + dx
    const y = cy - (cy - s.y) * f + dy
    szene.sicht = { z, x: Math.min(0, Math.max(r.width * (1 - z), x)), y: Math.min(0, Math.max(r.height * (1 - z), y)) }
  }, [szene, flaeche])

  React.useEffect(() => {
    if (!aktiv) { szene.sicht = { z: 1, x: 0, y: 0 }; zeiger.current.clear(); zug.current = null; kniff.current = null; return }
    const el = flaeche.current
    if (!el) return
    const rad = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomUm(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.002))
    }
    el.addEventListener('wheel', rad, { passive: false })
    return () => el.removeEventListener('wheel', rad)
  }, [aktiv, szene, flaeche, zoomUm])

  const mitte = (): { abstand: number; mx: number; my: number } => {
    const [a, b] = [...zeiger.current.values()]
    return { abstand: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
  }

  return {
    zuWelt: (clientX, clientY) => {
      const r = flaeche.current?.getBoundingClientRect()
      const s = szene.sicht
      return r ? [(clientX - r.left - s.x) / s.z, (clientY - r.top - s.y) / s.z] : [clientX, clientY]
    },
    unten: (e) => {
      if (!aktiv) return false
      zeiger.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (zeiger.current.size === 2) { zug.current = null; kniff.current = mitte(); return true }
      if (zeiger.current.size > 2 || o.aufPunkt(e)) return false
      zug.current = { x: e.clientX, y: e.clientY, weit: false }
      e.currentTarget.setPointerCapture(e.pointerId)
      return true
    },
    bewegt: (e) => {
      if (!aktiv || !zeiger.current.has(e.pointerId)) return false
      zeiger.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const k = kniff.current
      if (k && zeiger.current.size === 2) {
        const neu = mitte()
        const r = flaeche.current?.getBoundingClientRect()
        if (r && k.abstand > 0) zoomUm(neu.mx - r.left, neu.my - r.top, neu.abstand / k.abstand, neu.mx - k.mx, neu.my - k.my)
        kniff.current = neu
        geste.current = true
        return true
      }
      const z = zug.current
      if (!z) return false
      if (!z.weit && Math.hypot(e.clientX - z.x, e.clientY - z.y) < SCHWELLE) return true
      zoomUm(0, 0, 1, e.clientX - z.x, e.clientY - z.y)
      zug.current = { x: e.clientX, y: e.clientY, weit: true }
      geste.current = true
      return true
    },
    oben: (e) => {
      if (!zeiger.current.delete(e.pointerId)) return false
      const war = zug.current !== null || kniff.current !== null
      zug.current = null
      if (zeiger.current.size < 2) kniff.current = null
      return war
    },
    warGeste: () => { const g = geste.current; geste.current = false; return g },
    zoom: (faktor) => {
      const r = flaeche.current?.getBoundingClientRect()
      if (r) zoomUm(r.width / 2, r.height / 2, faktor)
    },
  }
}
