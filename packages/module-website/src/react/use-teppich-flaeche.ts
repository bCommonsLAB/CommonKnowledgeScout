'use client'

/**
 * Masse des Teppichs der Dokumente (Plan `teppich-der-dokumente`, Owner 23.11.2026).
 *
 * Die Leinwand ist so breit wie die Sektion, damit der Schwarm ueber den Rand fliegen kann; das
 * Raster liegt im Kasten in der Mitte (`teppichKasten`): so breit wie die Antwort, 16:9, nie
 * hoeher als der sichtbare Bereich. Dazu, ob die Flaeche im Bild ist.
 */

import * as React from 'react'
import { teppichKasten, type TeppichKasten } from '..'

/**
 * Hoehe des sichtbaren Bereichs: der naechste scrollende Behaelter (Site-Modus der App), sonst
 * das Fenster.
 */
export function sichtHoehe(el: HTMLElement): number {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p.clientHeight
  }
  return window.innerHeight
}

export interface TeppichFlaechenMasse {
  /** Breite der Leinwand (= Sektion). */
  breite: number
  kasten: TeppichKasten
  sichtbar: boolean
}

const LEER: TeppichFlaechenMasse = { breite: 0, kasten: { breite: 0, hoehe: 0, links: 0 }, sichtbar: true }

/** Misst die Ebene, in der `huelle` liegt (deren Elternelement spannt die Sektion auf). */
export function useTeppichFlaeche(huelle: React.RefObject<HTMLDivElement | null>): TeppichFlaechenMasse {
  const [masse, setMasse] = React.useState(LEER)
  React.useEffect(() => {
    const el = huelle.current
    const ebene = el?.parentElement
    if (!el || !ebene) return
    const miss = () => {
      const r = ebene.getBoundingClientRect()
      const breite = Math.floor(r.width)
      const k = teppichKasten(breite, sichtHoehe(ebene), r.height)
      // Nur bei echter Aenderung: ein neues Objekt hiesse ein neues Raster.
      setMasse((m) => (m.breite === breite && m.kasten.breite === k.breite && m.kasten.hoehe === k.hoehe
        ? m : { ...m, breite, kasten: k }))
    }
    miss()
    const ro = new ResizeObserver(miss)
    ro.observe(ebene)
    window.addEventListener('resize', miss)
    const io = new IntersectionObserver(([e]) => setMasse((m) => (m.sichtbar === e.isIntersecting ? m : { ...m, sichtbar: e.isIntersecting })))
    io.observe(el)
    return () => { ro.disconnect(); io.disconnect(); window.removeEventListener('resize', miss) }
  }, [huelle])
  return masse
}
