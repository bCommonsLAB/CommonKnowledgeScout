'use client'

/**
 * Kleine Messungen fuer die Leinwand des Teppichs (aus `website-teppich.tsx` herausgeloest,
 * 24.11.2026, Dateigrenze): ob Bewegung erlaubt ist, und wie hoch die Flaeche der Graph-Ansicht ist.
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
