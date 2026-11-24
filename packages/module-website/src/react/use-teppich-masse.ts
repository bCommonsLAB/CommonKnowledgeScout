'use client'

/**
 * Kleine Messungen fuer die Leinwand des Teppichs (aus `website-teppich.tsx` herausgeloest,
 * 24.11.2026, Dateigrenze): ob Bewegung erlaubt ist, wie hoch die Flaeche der Graph-Ansicht ist,
 * und die Farben der Leinwand.
 */

import * as React from 'react'

export function useBewegungErlaubt(): boolean {
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

/** Graph-Ansicht: Hoehe der Flaeche unter der Kopfzeile (so hoch, wie der Bildschirm sie laesst); sonst 0. */
export function useGraphHoehe(flaeche: React.RefObject<HTMLDivElement | null>, aktiv: boolean, breite: number): number {
  const [hoehe, setHoehe] = React.useState(0)
  React.useLayoutEffect(() => {
    if (!aktiv) { setHoehe(0); return }
    const miss = () => setHoehe(flaeche.current?.clientHeight ?? 0)
    miss()
    window.addEventListener('resize', miss)
    return () => window.removeEventListener('resize', miss)
  }, [aktiv, breite, flaeche])
  return hoehe
}

/**
 * Farben der Leinwand aus dem Stil der Ebene: die Schriftfarbe fuer die Wolke, der Akzent der Site
 * (`--site-accent-ink`, wie die Belegnummern im Text) fuer die Belege. Ausserhalb einer Website
 * mit Design-Profil gibt es keinen Akzent — dann tragen die Belege die Schriftfarbe.
 */
export function teppichFarben(el: HTMLElement | null): { farbe: string; akzent: string; schrift: string } {
  if (!el) return { farbe: 'currentColor', akzent: 'currentColor', schrift: 'system-ui, sans-serif' }
  const stil = getComputedStyle(el)
  const akzent = stil.getPropertyValue('--site-accent-ink').trim()
  return { farbe: stil.color, akzent: akzent !== '' ? akzent : stil.color, schrift: stil.fontFamily || 'system-ui, sans-serif' }
}

/**
 * Rechner: die Flaeche, die die Botschaft links oben ueber der Wolke belegt (Pixel der Leinwand).
 * Die Storyline weicht ihr aus, statt unter dem Text zu liegen. Auf dem Telefon steht die Botschaft
 * als Blatt am Bildschirmrand — dort gibt es nichts auszuweichen.
 */
export function botschaftFlaeche(flaeche: HTMLElement | null): { rechts: number; unten: number } | undefined {
  const el = flaeche?.querySelector('[data-teppich-botschaft="frei"]')
  if (!flaeche || !el) return undefined
  const f = flaeche.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  return { rechts: r.right - f.left, unten: r.bottom - f.top }
}
